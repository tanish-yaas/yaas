import ExcelJS from "exceljs";
import { z } from "zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { AI_CONFIG } from "@/config/ai";
import { isTransientModelError } from "@/lib/ai/errors";
import { withModelFallback } from "@/lib/ai/model-health";
import {
  datesIn,
  dedupe,
  ipNameFromSource,
  isValidDay,
  overlaps,
  within,
  type DeliverableRow,
  type Period,
} from "@/lib/deliverables";

/**
 * Reading the month's tracking sheets.
 *
 * Split deliberately down the middle. The dates, the reporting window and the
 * IP names are decided here, in code, because the sheets are consistent about
 * them and getting them wrong is invisible in the output. What the model is
 * asked for is the part that genuinely varies: which cell is the video's name,
 * whether a row is a deliverable at all, short form or long, live or not.
 *
 * The first build handed the window to the model as well. Against six real
 * sheets it returned 3 deliverables where there were 26, having silently
 * skipped the files holding the previous month.
 */

const rowSchema = z.object({
  sheet: z.string().describe("The SHEET name this row came from, copied exactly"),
  videoName: z.string().describe("The video's title, exactly as written"),
  date: z.string().describe("The row's date, YYYY-MM-DD"),
  endDate: z
    .string()
    .describe("Last day worked on it, YYYY-MM-DD. Same as date for one day"),
  kind: z.enum(["LF", "SF"]).describe("SF for a short, reel or story; LF for a long form video"),
  status: z
    .enum(["LIVE", "WIP"])
    .describe("LIVE once published, live or uploaded; WIP otherwise"),
});

const extractionSchema = z.object({
  rows: z.array(rowSchema),
  notes: z
    .array(z.string())
    .describe("Anything skipped or uncertain, one short line each"),
});

export type DeliverablesReport = {
  worked: DeliverableRow[];
  upcoming: DeliverableRow[];
  notes: string[];
  /** IP names the upload turned out to hold. */
  sources: string[];
  truncated: boolean;
};

const MAX_CHARS = 120_000;
const MAX_ROWS_PER_SHEET = 4000;
/** Header rows near the top of a section, kept so columns have meaning. */
const CONTEXT_MARKERS = /s\.?\s?no|video name|date|type|status|link/i;

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("");
    }
    return "";
  }
  return String(value);
}

type Sheet = { ip: string; lines: string[] };

/** Every upload flattened into sheets, each labelled with its IP name. */
async function readSheets(
  files: { name: string; buffer: ArrayBuffer }[]
): Promise<Sheet[]> {
  const sheets: Sheet[] = [];

  for (const file of files) {
    const lower = file.name.toLowerCase();

    if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);

      workbook.eachSheet((sheet) => {
        const lines: string[] = [];
        sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber > MAX_ROWS_PER_SHEET) return;
          const values = Array.isArray(row.values) ? row.values.slice(1) : [];
          const cells = values.map((v) => cellText(v as ExcelJS.CellValue).trim());
          if (cells.some(Boolean)) lines.push(cells.join(" | "));
        });
        if (lines.length > 0) {
          sheets.push({ ip: ipNameFromSource(sheet.name), lines });
        }
      });
      continue;
    }

    const text = new TextDecoder().decode(file.buffer).trim();
    if (!text) continue;
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.replace(/[,\s]/g, "").length > 0)
      .slice(0, MAX_ROWS_PER_SHEET);
    if (lines.length > 0) {
      sheets.push({ ip: ipNameFromSource(file.name), lines });
    }
  }

  return sheets;
}

/**
 * Only the rows the report could possibly need.
 *
 * A year of history in one file is mostly noise for a five week window, and
 * noise is what made the model lose whole months. Any row carrying a date
 * inside the window stays, whatever month heading it sits under; a few header
 * rows stay with it so the columns still mean something.
 */
function keepRelevant(sheet: Sheet, span: Period) {
  const kept: string[] = [];
  let contextLines = 0;

  for (const line of sheet.lines) {
    const dates = datesIn(line);

    if (dates.length === 0) {
      // Headers only, and only a few: totals and blank rows help nobody.
      if (contextLines < 4 && CONTEXT_MARKERS.test(line)) {
        kept.push(line);
        contextLines++;
      }
      continue;
    }

    if (dates.some((day) => within(day, span))) kept.push(line);
  }

  return kept;
}

function buildPrompt(sheets: { ip: string; lines: string[] }[]) {
  const body = sheets
    .map((s) => `SHEET: ${s.ip}\n${s.lines.join("\n")}`)
    .join("\n\n");

  return `You are reading rows from a content team's video tracking sheets.

Every row below has already been filtered to the reporting window, and the SHEET name above each block is already the IP name. Do not filter by date and do not rename anything: read each row and say what it is.

FOR EVERY ROW THAT IS A VIDEO DELIVERABLE
- sheet: the SHEET name above the row, copied exactly.
- videoName: the video's title from the row, word for word, including punctuation and emoji. These sheets keep it in a column called "VIDEO NAME" or "Video Name", usually near the end of the row. Never use the influencer's name, the page link or the type.
- date: the row's own date, as YYYY-MM-DD. The sheets write dates day first: 03/09/2026 is the 3rd of September 2026.
- endDate: the same day, unless the row clearly spans several days.
- kind: SF unless the row is clearly a long form video. These are Instagram and LinkedIn deliverables, so reels, shorts, stories, story reshares, reel collabs, carousels and posts are all SF.
- status: LIVE when the row shows it went out, for example a go-live link or a type like "Full Post Live", "Story Reshare", "Reel Collab", or an invoice marked Sent or Processed. WIP when it is still planned or has no link yet.

SKIP
- Header rows, month headings, totals, budget lines and blank rows.
- Any row with no video name. Do not invent one, and do not carry a name down from the row above.

notes: one short line for anything skipped that looked like it might have mattered, or anything you were unsure about. An empty array if it was all clean.

${body}`;
}

export async function extractDeliverables(params: {
  files: { name: string; buffer: ArrayBuffer }[];
  worked: Period;
  upcoming: Period;
}): Promise<
  { ok: true; report: DeliverablesReport } | { ok: false; error: string }
> {
  const sheets = await readSheets(params.files);
  if (sheets.length === 0) {
    return { ok: false, error: "Those files had no rows in them" };
  }

  // One span covering both windows, so the sheets are read once.
  const span: Period = {
    from:
      params.worked.from < params.upcoming.from
        ? params.worked.from
        : params.upcoming.from,
    to: params.worked.to > params.upcoming.to ? params.worked.to : params.upcoming.to,
  };

  // One block per IP, so a sheet and its "(old)" companion arrive as one.
  const byIp = new Map<string, string[]>();
  for (const sheet of sheets) {
    const lines = keepRelevant(sheet, span);
    if (!lines.some((line) => datesIn(line).length > 0)) continue;
    byIp.set(sheet.ip, [...(byIp.get(sheet.ip) ?? []), ...lines]);
  }

  let filtered = [...byIp.entries()].map(([ip, lines]) => ({ ip, lines }));

  // Nothing matched anywhere: rather than report an empty month, hand the
  // sheets over whole and let the model try. A date format nobody has seen
  // yet looks exactly like this.
  const fellBack = filtered.length === 0;
  if (fellBack) {
    const whole = new Map<string, string[]>();
    for (const sheet of sheets) {
      whole.set(sheet.ip, [...(whole.get(sheet.ip) ?? []), ...sheet.lines]);
    }
    filtered = [...whole.entries()].map(([ip, lines]) => ({ ip, lines }));
  }

  const prompt = buildPrompt(filtered);
  const truncated = prompt.length > MAX_CHARS;

  try {
    const result = await withModelFallback(
      { model: AI_CONFIG.reportModel, fallbackModel: AI_CONFIG.model },
      (modelId) =>
        generateObject({
          model: google(modelId),
          schema: extractionSchema,
          prompt: truncated ? prompt.slice(0, MAX_CHARS) : prompt,
          // Reading rows off a sheet, not writing: the same file should give
          // the same answer twice.
          temperature: 0,
          maxRetries: 0,
        }),
      isTransientModelError
    );

    const ipNames = new Set(filtered.map((s) => s.ip));
    const notes = [...result.object.notes];
    const rows: DeliverableRow[] = [];

    for (const row of result.object.rows) {
      const name = row.videoName.trim();
      if (!name) continue;

      if (!isValidDay(row.date)) {
        notes.push(`Skipped "${name}": no date Nova could read.`);
        continue;
      }

      const end = isValidDay(row.endDate) && row.endDate >= row.date ? row.endDate : row.date;

      // The model echoes the sheet name back; anything else is a stray.
      const ip = ipNames.has(row.sheet)
        ? row.sheet
        : ipNameFromSource(row.sheet);

      rows.push({
        ip,
        videoName: name,
        kind: row.kind,
        start: row.date,
        end,
        status: row.status,
      });
    }

    // The windows are applied here, not by the model.
    const worked = dedupe(rows.filter((row) => overlaps(row, params.worked)));
    const upcoming = dedupe(rows.filter((row) => overlaps(row, params.upcoming)));

    if (fellBack) {
      notes.push(
        "No dates matched the window, so the sheets were read whole. Check the dates in the output."
      );
    }

    return {
      ok: true,
      report: {
        worked,
        upcoming,
        notes,
        sources: [...ipNames],
        truncated,
      },
    };
  } catch (error) {
    console.error("[deliverables]", error);
    const message = error instanceof Error ? error.message : "";
    if (/429|quota|rate/i.test(message)) {
      return { ok: false, error: "Rate limit hit. Wait a minute and try again." };
    }
    // Worth its own message: nothing about the upload is wrong, and "check the
    // file" would send someone looking in the wrong place.
    if (/api key/i.test(message) || error?.constructor?.name === "LoadAPIKeyError") {
      return {
        ok: false,
        error: "AI isn't configured here. GOOGLE_GENERATIVE_AI_API_KEY is missing.",
      };
    }
    return {
      ok: false,
      error: "Couldn't read those sheets. Check the file and try again.",
    };
  }
}
