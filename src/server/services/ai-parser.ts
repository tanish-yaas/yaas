import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { prisma } from "@/lib/prisma";
import { AI_CONFIG } from "@/config/ai";
import { APP_CONFIG } from "@/config/app";
import { parsedTaskSchema, type ParsedTask } from "@/lib/ai/schemas";
import { isTransientModelError } from "@/lib/ai/errors";
import { markPrimaryDown, markPrimaryUp, primaryIsDown } from "@/lib/ai/model-health";
import {
  addDaysToKey,
  addMonthsToKey,
  istMonthStartKey,
  istTodayKey,
} from "@/lib/dates";

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

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Weekday index of an IST day key, without going through Intl per call. */
function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Every relative date the model might need, precomputed. It only has to look
 * one up — asking it to do calendar arithmetic is where most bad dates came
 * from. Day-key maths rather than millisecond offsets, so DST-free IST days
 * stay exact.
 */
function buildDateAnchors(todayKey: string): string {
  const todayIndex = weekdayOfKey(todayKey);
  const monthStart = istMonthStartKey(todayKey);

  const lines = [
    `today = ${todayKey} (${WEEKDAYS[todayIndex]})`,
    `tomorrow = ${addDaysToKey(todayKey, 1)} (${WEEKDAYS[(todayIndex + 1) % 7]})`,
    `day after tomorrow = ${addDaysToKey(todayKey, 2)}`,
    "",
  ];

  // "this Friday" and "next Friday" are different days and users mean both.
  // Anchoring only one of them was making the model pick the wrong week.
  for (let i = 0; i < 7; i++) {
    const delta = (i - todayIndex + 7) % 7;
    lines.push(
      `this ${WEEKDAYS[i]} = ${addDaysToKey(todayKey, delta)}` +
        `   ·   next ${WEEKDAYS[i]} = ${addDaysToKey(todayKey, delta + 7)}`
    );
  }

  lines.push(
    "",
    `in a week = ${addDaysToKey(todayKey, 7)}`,
    `in two weeks = ${addDaysToKey(todayKey, 14)}`,
    `end of this month = ${addDaysToKey(addMonthsToKey(monthStart, 1), -1)}`,
    `start of next month = ${addMonthsToKey(monthStart, 1)}`
  );

  return lines.join("\n");
}

function buildSystemPrompt(memberNames: string[], labels: string[]): string {
  const now = new Date();
  const todayKey = istTodayKey();
  const tomorrowKey = addDaysToKey(todayKey, 1);
  const todayIndex = weekdayOfKey(todayKey);

  const timeNow = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);

  return `You convert informal notes into structured tasks for a team workspace in India.
Extract only what the input actually says. Do not embellish.

CURRENT DATE AND TIME
It is ${timeNow} on ${WEEKDAYS[todayIndex]}, ${todayKey}, India Standard Time (UTC${OFFSET}).

DATE REFERENCE — look the answer up here, never calculate your own:
${buildDateAnchors(todayKey)}

RULES FOR dueAt
1. If a date OR a time is mentioned in any form, you MUST return a dueAt. Never return null when the user gave any timing hint.
2. Format: YYYY-MM-DDTHH:mm:00${OFFSET} — always include the ${OFFSET} offset.
3. A time with no date: use today if that time is still ahead of ${timeNow}, otherwise tomorrow.
4. A date with no time: use 17:00.
5. "morning" = 09:00, "afternoon" = 14:00, "evening" = 18:00, "EOD" / "end of day" = 18:00, "tonight" = 20:00, "first thing" = 09:00, "lunch" = 13:00.
6. A bare weekday ("on Friday") means the one in the DATE REFERENCE marked "this Friday".
7. Only return null for dueAt when there is genuinely no timing language at all.

RULES FOR title
Short and imperative — "Send the pitch deck", not "I need to send the pitch deck tomorrow".
Strip the timing, the assignee and the priority out of the title; they have their own fields.

PRIORITY
URGENT only for stated emergencies or same-day hard deadlines. HIGH when explicitly called important, or urgent-sounding language like "asap" and "blocking". MEDIUM by default. LOW when described as whenever or low priority.

PEOPLE
${
  memberNames.length > 0
    ? `Workspace members: ${memberNames.join(", ")}. Match mentioned names to these exactly as spelled above, including when the input misspells or shortens them. A name that clearly is not one of these goes in the description instead — never invent a member.`
    : "No other members yet. Leave assigneeNames empty."
}
If the input only describes the speaker's own work, leave assigneeNames empty.

LABELS
${labels.length > 0 ? `Existing labels: ${labels.join(", ")}. Reuse one of these before inventing a new one. Match on meaning, not just wording.` : "No labels yet — propose at most one, only if the topic is obvious."}

WORKED EXAMPLES
Input: "call mukesh today at 5 pm about the renewal"
→ title "Call Mukesh about the renewal", dueAt ${todayKey}T17:00:00${OFFSET}, priority MEDIUM, assigneeNames []

Input: "ask priya to send the deck by tomorrow morning, its blocking the pitch"
→ title "Send the pitch deck", dueAt ${tomorrowKey}T09:00:00${OFFSET}, priority HIGH,
  assigneeNames ["Priya"] if Priya is a member above, roadblock "Blocking the pitch"

Input: "review the pitch sometime"
→ title "Review the pitch", dueAt null, priority LOW, assigneeNames []

Input: "server is down, fix it now"
→ title "Fix the server outage", dueAt ${todayKey}T${timeNow}:00${OFFSET}, priority URGENT, riskLevel HIGH

Input: "plan offsite — book venue, sort catering, send invites"
→ title "Plan the offsite", subtasks ["Book venue", "Sort catering", "Send invites"], dueAt null

CONFIDENCE
Report honestly. Below 0.5 when you had to guess the date, the assignee, or what the task even is. Above 0.8 only when the input was explicit.

OTHER
Set clarifyingQuestion only when something essential is genuinely missing. Most inputs need none. Never invent people, deadlines, estimates or subtasks that were not implied.`;
}

async function callModel(
  system: string,
  prompt: string,
  attempt = 1
): Promise<Awaited<ReturnType<typeof generateObject<typeof parsedTaskSchema>>>> {
  // The primary only gets the first attempt, and only when it is not already
  // known to be down. Everything after that is the fallback.
  const usePrimary = attempt === 1 && !primaryIsDown();
  const model = usePrimary ? AI_CONFIG.model : AI_CONFIG.fallbackModel;

  try {
    const result = await generateObject({
      model: google(model),
      schema: parsedTaskSchema,
      system,
      prompt,
      // Extraction, not writing. Sampling at the model's default temperature is
      // why the same note could parse two different ways on two tries.
      temperature: 0,
      // The SDK's own retry re-tries the *same* model with exponential backoff,
      // which is the one thing that cannot help an overloaded one — measured at
      // 7.5s of waiting before it gave up and let us switch. Retrying is our
      // job here precisely because our retry changes model.
      maxRetries: 0,
    });

    if (usePrimary) markPrimaryUp();
    return result;
  } catch (err) {
    if (!isTransientModelError(err) || attempt >= 3) throw err;

    if (usePrimary) {
      // Skip the primary for the next minute rather than rediscovering this on
      // every request for as long as the outage lasts.
      markPrimaryDown();
    } else {
      // Only wait when the next attempt is the same model again. Switching
      // models needs no cooling-off period — that is the whole point of it.
      await new Promise((r) => setTimeout(r, attempt * 500));
    }

    return callModel(system, prompt, attempt + 1);
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

    // Worth separating: "the model is busy" is nothing to do with what was
    // typed, and telling someone to rephrase a perfectly good sentence sends
    // them rewriting it until the outage ends.
    return {
      ok: false,
      error: isTransientModelError(err)
        ? "The model is busy right now — try again in a moment, or add it manually below."
        : "Couldn't read that. Try rephrasing, or add it manually.",
    };
  }
}