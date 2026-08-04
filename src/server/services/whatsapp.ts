import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import { parseTaskInput } from "@/server/services/ai-parser";
import { computePriorityScore } from "@/server/services/tasks";

export type InboundMessage = {
  waMessageId: string;
  from: string;
  body: string;
  timestamp: Date;
};

export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return false;
  if (!header?.startsWith("sha256=")) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  const provided = header.slice(7);

  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export function extractMessages(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];

  const entries =
    (payload as { entry?: Array<{ changes?: Array<{ value?: unknown }> }> })
      ?.entry ?? [];

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value as
        | {
            messages?: Array<{
              id?: string;
              from?: string;
              timestamp?: string;
              type?: string;
              text?: { body?: string };
            }>;
          }
        | undefined;

      for (const message of value?.messages ?? []) {
        if (message.type !== "text") continue;
        if (!message.id || !message.from || !message.text?.body) continue;

        out.push({
          waMessageId: message.id,
          from: `+${message.from.replace(/^\+/, "")}`,
          body: message.text.body,
          timestamp: message.timestamp
            ? new Date(Number(message.timestamp) * 1000)
            : new Date(),
        });
      }
    }
  }

  return out;
}

async function reply(to: string, body: string, orgId: string | null) {
  const provider = getWhatsAppProvider();
  const result = await provider.sendText({ to, body });

  await prisma.whatsAppMessage.create({
    data: {
      organizationId: orgId,
      waMessageId: result.ok ? result.providerMessageId : `failed-${Date.now()}`,
      direction: "OUTBOUND",
      status: result.ok ? "SENT" : "FAILED",
      fromNumber: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "system",
      toNumber: to,
      body,
      sentAt: result.ok ? new Date() : null,
      errorMessage: result.ok ? null : result.error,
    },
  });
}

async function tryLinkNumber(message: InboundMessage): Promise<boolean> {
  const code = message.body.trim().toUpperCase();
  if (!/^LINK-[A-Z0-9]{6}$/.test(code)) return false;

  const token = await prisma.verificationToken.findFirst({
    where: { token: code, expires: { gt: new Date() } },
  });
  if (!token || !token.identifier.startsWith("whatsapp:")) return false;

  const userId = token.identifier.slice("whatsapp:".length);

  const taken = await prisma.profile.findFirst({
    where: { whatsappNumber: message.from, userId: { not: userId } },
  });
  if (taken) {
    await reply(
      message.from,
      "That number is already linked to another Nova account.",
      null
    );
    return true;
  }

  await prisma.profile.update({
    where: { userId },
    data: {
      whatsappNumber: message.from,
      whatsappVerified: true,
      whatsappVerifiedAt: new Date(),
      whatsappOptIn: true,
    },
  });

  await prisma.verificationToken.deleteMany({
    where: { identifier: token.identifier },
  });

  const membership = await prisma.organizationMember.findFirst({
    where: { userId, status: "ACTIVE" },
  });

  await reply(
    message.from,
    "Linked. Send me anything you need to do and I'll turn it into a task.\n\nTry: \"call the supplier tomorrow at 3\"",
    membership?.organizationId ?? null
  );

  return true;
}

export async function handleInbound(message: InboundMessage) {
  const profile = await prisma.profile.findFirst({
    where: { whatsappNumber: message.from, whatsappVerified: true },
  });

  if (!profile) {
    const linked = await tryLinkNumber(message);
    if (!linked) {
      await reply(
        message.from,
        "This number isn't linked to a Nova account yet. Open Nova → Settings → WhatsApp to get a link code.",
        null
      );
    }
    return;
  }

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: profile.userId, status: "ACTIVE" },
  });

  if (!membership) {
    await reply(message.from, "Your workspace access isn't active.", null);
    return;
  }

  const orgId = membership.organizationId;

  await prisma.whatsAppMessage.create({
    data: {
      organizationId: orgId,
      userId: profile.userId,
      waMessageId: message.waMessageId,
      direction: "INBOUND",
      status: "DELIVERED",
      fromNumber: message.from,
      toNumber: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "system",
      body: message.body,
      deliveredAt: message.timestamp,
    },
  });

  const parsed = await parseTaskInput({
    rawInput: message.body,
    orgId,
    userId: profile.userId,
    timezone: profile.timezone,
  });

  if (!parsed.ok) {
    await reply(message.from, `Couldn't read that one. ${parsed.error}`, orgId);
    return;
  }

  const p = parsed.parsed;
  const dueAt = p.dueAt ? new Date(p.dueAt) : null;
  const validDue = dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null;

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        organizationId: orgId,
        createdById: profile.userId,
        title: p.title,
        description: p.description || null,
        priority: p.priority,
        priorityScore: computePriorityScore(p.priority, validDue),
        dueAt: validDue,
        estimatedMinutes: p.estimatedMinutes ?? null,
        status: "TODO",
        source: "WHATSAPP",
        aiParsedTaskId: parsed.parsedTaskId,
        riskLevel: p.riskLevel,
        roadblock: p.roadblock || null,
      },
    });

    await tx.taskAssignment.create({
      data: {
        organizationId: orgId,
        taskId: created.id,
        userId: profile.userId,
        role: "OWNER",
        assignedById: profile.userId,
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
        timeZone: profile.timezone,
      }).format(validDue)
    : "no deadline";

  const lines = [
    `✓ ${task.title}`,
    `${p.priority.toLowerCase()} priority · ${dueText}`,
  ];

  if (p.clarifyingQuestion) lines.push("", p.clarifyingQuestion);

  await reply(message.from, lines.join("\n"), orgId);
}