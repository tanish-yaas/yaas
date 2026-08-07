import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { postSlackMessage, getSlackUserEmail } from "@/lib/slack/provider";
import { parseTaskInput } from "@/server/services/ai-parser";
import { runChat } from "@/server/services/ai-chat";
import { computePriorityScore } from "@/server/services/tasks";
import { SLACK_HELP } from "@/config/slack";
import { APP_CONFIG } from "@/config/app";
import { AI_CONFIG } from "@/config/ai";

export type InboundSlackMessage = {
  eventId: string;
  slackUserId: string;
  channel: string;
  /** Present when the message already sits in a thread. */
  threadTs?: string;
  ts: string;
  text: string;
};

type Sender = {
  userId: string;
  orgId: string;
  timezone: string;
  displayName: string;
  permissions: Set<string>;
};

/** "add the deck", "remind me to call Priya" — an explicit instruction to capture. */
const CAPTURE_OPENERS = /^(add|task|todo|new task|remind me to)\b/i;

/**
 * Question shapes people actually type. Deliberately "show me"/"give me"
 * rather than bare "show"/"give", so "give Aniket a call" is not mistaken for
 * a request for information.
 */
const QUESTION_OPENERS =
  /^(what|whats|when|where|who|whose|which|why|how|is|are|am|do|does|did|can|could|should|shall|will|would|have|has|any|anything|list|find|search|summarise|summarize|catch me up|show me|tell me|give me|remind me what)\b/i;

/**
 * Cheap pass first. Returns "unsure" rather than guessing, so the caller can
 * spend a model call only on the genuinely ambiguous ones.
 */
export function classifyFast(text: string): "chat" | "task" | "unsure" {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (CAPTURE_OPENERS.test(lower)) return "task";
  if (/^(\?|ask\b)/.test(lower)) return "chat";
  if (trimmed.endsWith("?")) return "chat";
  if (QUESTION_OPENERS.test(lower)) return "chat";

  return "unsure";
}

/**
 * A question gets answered; anything else gets captured as a task.
 *
 * Keyword matching alone was too blunt — "give me the tasks for tomorrow" has
 * no question mark and filed itself as a task. Explicit phrasing still decides
 * without a round trip; only the ambiguous remainder costs a model call.
 *
 * Falls back to "task" whenever the model is unavailable or unsure. Filing a
 * junk task is visible and reversible; answering a note as if it were a
 * question throws the note away.
 */
export async function classify(text: string): Promise<"chat" | "task"> {
  const fast = classifyFast(text);
  if (fast !== "unsure") return fast;

  try {
    const result = await generateObject({
      model: google(AI_CONFIG.fallbackModel),
      schema: z.object({
        intent: z
          .enum(["question", "capture"])
          .describe(
            "question = asking about existing work. capture = something to be done."
          ),
      }),
      system:
        "Classify one message sent to a task assistant. " +
        '"question" means the sender wants information about work that already exists. ' +
        '"capture" means the sender is describing something that needs doing. ' +
        "Reply with the label only.",
      prompt: text.trim().slice(0, 500),
      temperature: 0,
    });

    return result.object.intent === "question" ? "chat" : "task";
  } catch (err) {
    console.error("[slack:classify]", err);
    return "task";
  }
}

/** Strip the "add "/"task " prefix and any @-mention of the bot. */
export function cleanText(text: string): string {
  return text
    .replace(/<@[A-Z0-9]+>/gi, " ")
    .replace(/^\s*(add|task|todo)\b[:,]?\s*/i, "")
    .replace(/^\s*\?\s*/, "")
    .trim();
}

async function resolveSender(slackUserId: string): Promise<Sender | null> {
  const email = await getSlackUserEmail(slackUserId);
  if (!email) return null;

  const user = await prisma.user.findFirst({
    where: { email },
    include: { profile: true },
  });
  if (!user) return null;

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });
  if (!membership) return null;

  return {
    userId: user.id,
    orgId: membership.organizationId,
    timezone: user.profile?.timezone ?? APP_CONFIG.timezone,
    displayName: user.profile?.displayName ?? user.name ?? "there",
    permissions: new Set(
      membership.role.permissions.map((rp) => rp.permission.key)
    ),
  };
}

async function answer(message: InboundSlackMessage, sender: Sender) {
  const { permissions } = sender;

  if (!permissions.has("ai.use")) {
    await postSlackMessage(
      message.channel,
      "You don't have assistant access in this workspace.",
      message.threadTs ?? message.ts
    );
    return;
  }

  const result = await runChat({
    ctx: {
      orgId: sender.orgId,
      userId: sender.userId,
      timezone: sender.timezone,
      permissions,
    },
    history: [],
    message: cleanText(message.text),
  });

  if (!result.ok) {
    await postSlackMessage(
      message.channel,
      result.error,
      message.threadTs ?? message.ts
    );
    return;
  }

  const lines = [result.reply.text];

  // Proposals need confirming in the app — saying so here keeps Slack honest
  // about what has and hasn't happened.
  if (result.reply.proposals.length > 0) {
    lines.push(
      "",
      `${result.reply.proposals.length} change${
        result.reply.proposals.length === 1 ? "" : "s"
      } waiting for you to confirm in Nova.`
    );
  }

  await postSlackMessage(
    message.channel,
    lines.join("\n"),
    message.threadTs ?? message.ts
  );
}

async function capture(message: InboundSlackMessage, sender: Sender) {
  const body = cleanText(message.text);
  if (!body) return;

  const parsed = await parseTaskInput({
    rawInput: body,
    orgId: sender.orgId,
    userId: sender.userId,
    timezone: sender.timezone,
  });

  if (!parsed.ok) {
    await postSlackMessage(
      message.channel,
      `Couldn't read that one. ${parsed.error}`,
      message.threadTs ?? message.ts
    );
    return;
  }

  const p = parsed.parsed;
  const dueAt = p.dueAt ? new Date(p.dueAt) : null;
  const validDue = dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null;

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        organizationId: sender.orgId,
        createdById: sender.userId,
        title: p.title,
        description: p.description || null,
        priority: p.priority,
        priorityScore: computePriorityScore(p.priority, validDue),
        dueAt: validDue,
        estimatedMinutes: p.estimatedMinutes ?? null,
        status: "TODO",
        source: "SLACK",
        aiParsedTaskId: parsed.parsedTaskId,
        riskLevel: p.riskLevel,
        roadblock: p.roadblock || null,
      },
    });

    await tx.taskAssignment.create({
      data: {
        organizationId: sender.orgId,
        taskId: created.id,
        userId: sender.userId,
        role: "OWNER",
        assignedById: sender.userId,
      },
    });

    await tx.aIParsedTask.update({
      where: { id: parsed.parsedTaskId },
      data: { status: "APPLIED", appliedAt: new Date(), sourceMessageId: null },
    });

    return created;
  });

  const dueText = validDue
    ? new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: sender.timezone,
      }).format(validDue)
    : "no deadline";

  const lines = [
    `✓ ${task.title}`,
    `${p.priority.toLowerCase()} priority · ${dueText}`,
  ];

  if (p.clarifyingQuestion) lines.push("", p.clarifyingQuestion);

  await postSlackMessage(
    message.channel,
    lines.join("\n"),
    message.threadTs ?? message.ts
  );
}

export async function handleSlackInbound(message: InboundSlackMessage) {
  const sender = await resolveSender(message.slackUserId);

  if (!sender) {
    await postSlackMessage(
      message.channel,
      "I can't match your Slack account to a Nova user. Sign in to Nova with the same email as your Slack account and try again.",
      message.threadTs ?? message.ts
    );
    return;
  }

  if (!cleanText(message.text)) {
    await postSlackMessage(
      message.channel,
      SLACK_HELP,
      message.threadTs ?? message.ts
    );
    return;
  }

  if ((await classify(message.text)) === "chat") {
    await answer(message, sender);
    return;
  }

  await capture(message, sender);
}
