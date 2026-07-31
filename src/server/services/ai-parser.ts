import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { prisma } from "@/lib/prisma";
import { AI_CONFIG } from "@/config/ai";
import { APP_CONFIG } from "@/config/app";
import { parsedTaskSchema, type ParsedTask } from "@/lib/ai/schemas";

export type ParseSuccess = {
  ok: true;
  parsed: ParsedTask;
  parsedTaskId: string;
};

export type ParseFailure = {
  ok: false;
  error: string;
};

export type ParseResult = ParseSuccess | ParseFailure;

type ParseParams = {
  rawInput: string;
  orgId: string;
  userId: string;
  timezone?: string;
};

const TZ = APP_CONFIG.timezone;
const OFFSET = "+05:30";

function isoDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function dayName(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "long",
  }).format(d);
}

function buildDateAnchors(): string {
  const now = new Date();
  const lines: string[] = [];

  const add = (days: number) => new Date(now.getTime() + days * 86_400_000);

  lines.push(`today = ${isoDate(now)} (${dayName(now)})`);
  lines.push(`tomorrow = ${isoDate(add(1))} (${dayName(add(1))})`);

  const targets = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  for (const target of targets) {
    for (let i = 1; i <= 7; i++) {
      const candidate = add(i);
      if (dayName(candidate) === target) {
        lines.push(`next ${target} = ${isoDate(candidate)}`);
        break;
      }
    }
  }

  lines.push(`in a week = ${isoDate(add(7))}`);
  lines.push(`end of month = ${isoDate(add(30))}`);

  return lines.join("\n");
}

function buildSystemPrompt(memberNames: string[], labels: string[]): string {
  const now = new Date();
  const timeNow = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  return `You convert informal notes into structured tasks for a team workspace in India.

CURRENT DATE AND TIME
It is ${timeNow} on ${dayName(now)}, ${isoDate(now)}, India Standard Time (UTC${OFFSET}).

DATE REFERENCE — use these exact values, do not calculate your own:
${buildDateAnchors()}

RULES FOR dueAt
1. If a date OR a time is mentioned in any form, you MUST return a dueAt. Never return null when the user gave any timing hint.
2. Format: YYYY-MM-DDTHH:mm:00${OFFSET} — always include the ${OFFSET} offset.
3. A time with no date: use today if that time is still ahead of ${timeNow}, otherwise tomorrow.
4. A date with no time: use 17:00.
5. "morning" = 09:00, "afternoon" = 14:00, "evening" = 18:00, "EOD" / "end of day" = 18:00, "tonight" = 20:00.
6. Only return null for dueAt when there is genuinely no timing language at all.

EXAMPLES
"call mukesh today at 5 pm" → dueAt ${isoDate(now)}T17:00:00${OFFSET}
"send deck by tomorrow morning" → dueAt ${isoDate(new Date(Date.now() + 86400000))}T09:00:00${OFFSET}
"finish report EOD" → dueAt ${isoDate(now)}T18:00:00${OFFSET}
"review the pitch" → dueAt null

PRIORITY
URGENT only for stated emergencies or same-day hard deadlines. HIGH when explicitly called important or urgent-sounding. MEDIUM by default. LOW when described as whenever or low priority.

PEOPLE
${
  memberNames.length > 0
    ? `Workspace members: ${memberNames.join(", ")}. Match mentioned names to these. Names not on this list go in the description instead.`
    : "No other members yet. Leave assigneeNames empty."
}

LABELS
${labels.length > 0 ? `Existing labels: ${labels.join(", ")}. Reuse before inventing.` : "No labels yet."}

OTHER
Set clarifyingQuestion only when something essential is genuinely missing. Most inputs need none. Never invent people, deadlines or estimates that were not implied.`;
}

async function callModel(
  system: string,
  prompt: string,
  attempt = 1
): Promise<Awaited<ReturnType<typeof generateObject<typeof parsedTaskSchema>>>> {
  try {
    return await generateObject({
      model: google(
        attempt === 1 ? AI_CONFIG.model : AI_CONFIG.fallbackModel
      ),
      schema: parsedTaskSchema,
      system,
      prompt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const rateLimited = /429|quota|rate.?limit|resource.?exhausted/i.test(message);

    if (rateLimited && attempt < 3) {
      await new Promise((r) => setTimeout(r, attempt * 2500));
      return callModel(system, prompt, attempt + 1);
    }

    throw err;
  }
}

export async function parseTaskInput(params: ParseParams): Promise<ParseResult> {
  const input = params.rawInput.trim().slice(0, AI_CONFIG.maxInputChars);
  if (!input) {
    return { ok: false, error: "Type something first" };
  }

  const [members, labelRows] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: params.orgId, status: "ACTIVE" },
      include: { user: { select: { name: true } } },
      take: 100,
    }),
    prisma.label.findMany({
      where: { organizationId: params.orgId },
      select: { name: true },
      take: 40,
    }),
  ]);

  const memberNames: string[] = [];
  for (const m of members) {
    if (m.user.name) memberNames.push(m.user.name);
  }

  const record = await prisma.aIParsedTask.create({
    data: {
      organizationId: params.orgId,
      userId: params.userId,
      rawInput: input,
      model: AI_CONFIG.model,
      promptVersion: AI_CONFIG.promptVersion,
      status: "PROCESSING",
    },
  });

  const started = Date.now();

  try {
    const system = buildSystemPrompt(memberNames, labelRows.map((l) => l.name));
    const result = await callModel(system, input);

    await prisma.aIParsedTask.update({
      where: { id: record.id },
      data: {
        parsedOutput: result.object,
        confidence: result.object.confidence,
        status: "COMPLETED",
        promptTokens: result.usage?.inputTokens ?? null,
        completionTokens: result.usage?.outputTokens ?? null,
        totalTokens: result.usage?.totalTokens ?? null,
        latencyMs: Date.now() - started,
      },
    });

    return { ok: true, parsed: result.object, parsedTaskId: record.id };
  } catch (err) {
    console.error("[ai-parser]", err);
    const message = err instanceof Error ? err.message : "Parsing failed";

    await prisma.aIParsedTask.update({
      where: { id: record.id },
      data: {
        status: "FAILED",
        error: message.slice(0, 500),
        latencyMs: Date.now() - started,
      },
    });

    const rateLimited = /429|quota|rate|exhausted/i.test(message);

    return {
      ok: false,
      error: rateLimited
        ? "Too many requests just now. Add it manually below, or wait a moment."
        : "Couldn't read that. Try rephrasing, or add it manually.",
    };
  }
}