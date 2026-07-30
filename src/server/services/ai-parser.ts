import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { prisma } from "@/lib/prisma";
import { AI_CONFIG } from "@/config/ai";
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
  timezone: string;
};

type PromptContext = {
  now: string;
  timezone: string;
  memberNames: string[];
  labels: string[];
};

function buildSystemPrompt(opts: PromptContext): string {
  return [
    "You convert informal notes into structured tasks for a team workspace.",
    "",
    `Current time: ${opts.now} (${opts.timezone}).`,
    "Resolve relative dates against that time. 'Thursday' means the next",
    "upcoming Thursday. 'Tomorrow morning' means 09:00 the following day.",
    "Return dueAt in ISO 8601 with a timezone offset.",
    "",
    opts.memberNames.length > 0
      ? `Workspace members: ${opts.memberNames.join(", ")}. Match mentioned names to these where a match is plausible.`
      : "No other members in this workspace yet.",
    "",
    opts.labels.length > 0
      ? `Existing labels: ${opts.labels.join(", ")}. Reuse these before inventing new ones.`
      : "",
    "",
    "Set clarifyingQuestion only when a genuinely essential detail is missing.",
    "Do not ask about optional fields. Most inputs need no question.",
    "Never invent deadlines, people, or effort estimates that were not implied.",
  ]
    .filter(Boolean)
    .join("\n");
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

  const now = new Date();
  const nowLabel = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: params.timezone,
  }).format(now);

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
    const result = await generateObject({
      model: google(AI_CONFIG.model),
      schema: parsedTaskSchema,
      system: buildSystemPrompt({
        now: nowLabel,
        timezone: params.timezone,
        memberNames,
        labels: labelRows.map((l) => l.name),
      }),
      prompt: input,
    });

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

    return {
      ok: true,
      parsed: result.object,
      parsedTaskId: record.id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Parsing failed";

    await prisma.aIParsedTask.update({
      where: { id: record.id },
      data: {
        status: "FAILED",
        error: message.slice(0, 500),
        latencyMs: Date.now() - started,
      },
    });

    const rateLimited = /429|quota|rate/i.test(message);

    return {
      ok: false,
      error: rateLimited
        ? "Free tier rate limit hit. Wait a minute and try again."
        : "Couldn't parse that. Try rephrasing, or add it manually.",
    };
  }
}