import ExcelJS from "exceljs";
import { z } from "zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { AI_CONFIG } from "@/config/ai";
import { isTransientModelError } from "@/lib/ai/errors";
import { withModelFallback } from "@/lib/ai/model-health";

/**
 * The monthly deliverables report.
 *
 * The sheets this reads are not one shape: every IP tracks its videos its own
 * way, columns get renamed, and a month's export is whatever the team pasted
 * together. So the model does the reading — which is what was already
 * happening, by hand, in a chat window — and this file does everything that
 * must not be guessed: the date window, the counts, and the exact line format
 * the form wants. The model returns rows; it never writes the answer.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const rowSchema = z.object({
  ip: z.string().describe("The sheet or section this row came from"),
  videoName: z.string(),
  kind: z.enum(["LF", "SF"]).describe("LF for long form, SF for short form"),
  start: z.string().regex(DATE).describe("First day worked on it, YYYY-MM-DD"),
  end: z.string().regex(DATE).describe("Last day worked on it, YYYY-MM-DD"),
  status: z
    .enum(["LIVE", "WIP"])
    .describe("LIVE once published or uploaded, WIP otherwise"),
});

const reportSchema = z.object({
  worked: z.array(rowSchema),
  upcoming: z.array(rowSchema),
  notes: z
    .array(z.string())
    .describe("Anything skipped or uncertain, one short line each"),
});

export type DeliverableRow = z.infer<typeof rowSchema>;

export type DeliverablesReport = {
  worked: DeliverableRow[];
  upcoming: DeliverableRow[];
  notes: string[];
  /** Sheet or file names the upload turned out to hold. */
  sources: string[];
  truncated: boolean;
};

export type Period = { from: string; to: string };

const MAX_CHARS = 120_000;
const MAX_ROWS_PER_SHEET = 2000;

/** 2026-09-21 → 21/09/26, the form's format. Strings only: no Date, no zone. */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/** 2026-09-21 → 21/09/2026, for the sentence above the list. */
function formatLongDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

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

/**
 * Everything uploaded, flattened into one labelled text block.
 *
 * A workbook's tabs and a CSV's filename both become "SHEET: <name>", because
 * an IP is a sheet either way — which is the one thing about these files that
 * is always true.
 */
export async function filesToText(
  files: { name: string; buffer: ArrayBuffer }[]
): Promise<{ text: string; sources: string[]; truncated: boolean }> {
  const blocks: string[] = [];
  const sources: string[] = [];

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
          sources.push(sheet.name);
          blocks.push(`SHEET: ${sheet.name}\n${lines.join("\n")}`);
        }
      });
      continue;
    }

    // CSV, TSV or anything else text-shaped.
    const text = new TextDecoder().decode(file.buffer).trim();
    if (!text) continue;
    const name = file.name.replace(/\.[^.]+$/, "");
    sources.push(name);
    blocks.push(`SHEET: ${name}\n${text}`);
  }

  const joined = blocks.join("\n\n");
  return {
    text: joined.slice(0, MAX_CHARS),
    sources,
    truncated: joined.length > MAX_CHARS,
  };
}

function buildPrompt(worked: Period, upcoming: Period, sheets: string) {
  return `You are reading a content team's video tracking sheets and pulling out two lists.

Each "SHEET:" below is one IP (a channel or show). The sheet name is the IP name — use it exactly as written, never invent or tidy it.

LIST 1 — worked on between ${worked.from} and ${worked.to} (inclusive).
Include a video if any of the work on it falls inside that window, even if it started earlier or is still unfinished.

LIST 2 — to be worked on between ${upcoming.from} and ${upcoming.to} (inclusive).
Take these from rows already in the sheets: scheduled, planned or upcoming work dated in that window, and work in progress carried into it. Do not invent videos that are not in the sheets.

FOR EVERY ROW
- videoName: the video's title as written in the sheet. Keep the original wording and punctuation.
- kind: LF for a long form video, SF for a short form (short, reel, YouTube Short). The sheets may say "Long"/"Short"/"LF"/"SF"/"Shorts"/"Reel" — map them. If a sheet is entirely one kind, use that kind.
- start and end: the first and last day worked on it, YYYY-MM-DD. A single day means start and end are the same day. Never use the publish date as the work date unless that is the only date given.
- status: LIVE if the sheet shows it published, live, uploaded or done; WIP for anything still in progress.
- ip: the SHEET name it came from.

RULES
- Only rows that are actual video deliverables. Skip header rows, totals, blank rows and notes.
- A row with no usable date cannot be placed in a window: leave it out and say so in notes.
- Do not guess a year. If a date has no year, use the year that puts it inside the requested window.
- notes: short lines about anything skipped, ambiguous or worth a second look. Empty array if everything was clean.

SHEETS
${sheets}`;
}

export async function extractDeliverables(params: {
  files: { name: string; buffer: ArrayBuffer }[];
  worked: Period;
  upcoming: Period;
}): Promise<
  { ok: true; report: DeliverablesReport } | { ok: false; error: string }
> {
  const { text, sources, truncated } = await filesToText(params.files);

  if (!text.trim()) {
    return { ok: false, error: "Those files had no rows in them" };
  }

  try {
    const result = await withModelFallback(
      { model: AI_CONFIG.reportModel, fallbackModel: AI_CONFIG.model },
      (modelId) =>
        generateObject({
          model: google(modelId),
          schema: reportSchema,
          prompt: buildPrompt(params.worked, params.upcoming, text),
          // Reading rows off a sheet, not writing: the same file should give
          // the same answer twice.
          temperature: 0,
          maxRetries: 0,
        }),
      isTransientModelError
    );

    return {
      ok: true,
      report: { ...result.object, sources, truncated },
    };
  } catch (error) {
    console.error("[deliverables]", error);
    const message = error instanceof Error ? error.message : "";
    if (/429|quota|rate/i.test(message)) {
      return { ok: false, error: "Rate limit hit — wait a minute and try again." };
    }
    // Worth its own message: nothing about the upload is wrong, and "check the
    // file" would send someone looking in the wrong place.
    if (/api key/i.test(message) || error?.constructor?.name === "LoadAPIKeyError") {
      return {
        ok: false,
        error: "AI isn't configured here — GOOGLE_GENERATIVE_AI_API_KEY is missing.",
      };
    }
    return {
      ok: false,
      error: "Couldn't read those sheets. Check the file and try again.",
    };
  }
}

function group(rows: DeliverableRow[]) {
  const byIp = new Map<string, DeliverableRow[]>();
  for (const row of rows) {
    const list = byIp.get(row.ip) ?? [];
    list.push(row);
    byIp.set(row.ip, list);
  }
  for (const list of byIp.values()) {
    list.sort((a, b) => a.start.localeCompare(b.start) || a.videoName.localeCompare(b.videoName));
  }
  return byIp;
}

/** One line, exactly as the form wants it. */
function line(row: DeliverableRow) {
  return `IP Name- ${row.ip} , Video Name- ${row.videoName}, ${row.kind}, ${formatDay(row.start)} to ${formatDay(row.end)}`;
}

function blocks(rows: DeliverableRow[]) {
  return [...group(rows).entries()]
    .map(([ip, list]) => `${ip}\n\n${list.map(line).join("\n")}`)
    .join("\n\n");
}

export type FormattedReport = {
  answerOne: string;
  answerTwo: string;
  counts: {
    total: number;
    longForm: number;
    shortForm: number;
    live: number;
    wip: number;
    upcoming: number;
    ips: number;
  };
};

/**
 * The two answers, built here rather than by the model: counts that must add
 * up, and a format a form is going to be pasted into.
 */
export function formatReport(
  report: DeliverablesReport,
  worked: Period,
  upcoming: Period
): FormattedReport {
  const counts = {
    total: report.worked.length,
    longForm: report.worked.filter((r) => r.kind === "LF").length,
    shortForm: report.worked.filter((r) => r.kind === "SF").length,
    live: report.worked.filter((r) => r.status === "LIVE").length,
    wip: report.worked.filter((r) => r.status === "WIP").length,
    upcoming: report.upcoming.length,
    ips: group(report.worked).size,
  };

  const summary =
    `${formatLongDay(worked.from)} to ${formatLongDay(worked.to)} — ${counts.total} ` +
    `${counts.total === 1 ? "deliverable" : "deliverables"}: ${counts.longForm} long form, ` +
    `${counts.shortForm} short form. ${counts.live} went live, ${counts.wip} still work in progress.`;

  const answerOne =
    counts.total === 0
      ? "No deliverables found in that period."
      : `${summary}\n\n${blocks(report.worked)}`;

  const answerTwo =
    report.upcoming.length === 0
      ? `Nothing scheduled in the sheets for ${formatLongDay(upcoming.from)} to ${formatLongDay(upcoming.to)}.`
      : `${formatLongDay(upcoming.from)} to ${formatLongDay(upcoming.to)} — ${report.upcoming.length} planned.\n\n${blocks(report.upcoming)}`;

  return { answerOne, answerTwo, counts };
}
