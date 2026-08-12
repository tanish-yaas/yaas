"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, checkRate } from "@/server/rbac/guard";
import { LIMITS } from "@/lib/rate-limit";
import { parseTaskInput } from "@/server/services/ai-parser";
import { transcribeAudio } from "@/server/services/transcribe";
import { computePriorityScore } from "@/server/services/tasks";
import { fromLocalInput } from "@/lib/dates";
import type { ParsedTask } from "@/lib/ai/schemas";

export async function parseTask(rawInput: string) {
  const ctx = await requirePermission("ai.use");

  const rate = checkRate(
    ctx.session.user.id,
    "ai-parse",
    LIMITS.aiParse.limit,
    LIMITS.aiParse.window
  );

  if (!rate.allowed) {
    return {
      ok: false as const,
      error: `Slow down a moment — try again in ${rate.retryAfterSeconds}s.`,
    };
  }

  return parseTaskInput({
    rawInput,
    orgId: ctx.membership!.organizationId,
    userId: ctx.session.user.id,
  });
}

/** Audio a phone or laptop mic can realistically produce, and Gemini accepts. */
const AUDIO_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/aac",
  "audio/flac",
];

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/**
 * Speak a task instead of typing it: transcribe the clip, then hand the text
 * to the same parser the typed composer uses.
 *
 * Both steps happen here rather than round-tripping the transcript to the
 * browser and back, because the second call needs the first's output and the
 * audio is already the expensive part of the trip. The user still confirms —
 * this returns a draft, exactly as parseTask does, and writes nothing.
 */
export async function transcribeToTask(formData: FormData) {
  const ctx = await requirePermission("ai.use");

  const rate = checkRate(
    ctx.session.user.id,
    "ai-transcribe",
    LIMITS.aiTranscribe.limit,
    LIMITS.aiTranscribe.window
  );

  if (!rate.allowed) {
    return {
      ok: false as const,
      error: `Slow down a moment — try again in ${rate.retryAfterSeconds}s.`,
    };
  }

  const file = formData.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Nothing was recorded" };
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return { ok: false as const, error: "That recording is too long" };
  }

  // The browser appends codec parameters ("audio/webm;codecs=opus"); the
  // allowlist matches on the base type.
  const mediaType = (file.type || "audio/webm").split(";")[0].trim();
  if (!AUDIO_TYPES.includes(mediaType)) {
    return { ok: false as const, error: "That audio format isn't supported" };
  }

  const transcript = await transcribeAudio(
    new Uint8Array(await file.arrayBuffer()),
    mediaType
  );
  if (!transcript.ok) return { ok: false as const, error: transcript.error };

  const parsed = await parseTaskInput({
    rawInput: transcript.text,
    orgId: ctx.membership!.organizationId,
    userId: ctx.session.user.id,
  });

  // The transcript rides along either way: on success the composer shows what
  // it heard next to the draft, and on a parse failure it is all the user has
  // left of the recording, so losing it would mean recording again.
  if (!parsed.ok) {
    return { ok: false as const, error: parsed.error, transcript: transcript.text };
  }

  return {
    ok: true as const,
    transcript: transcript.text,
    parsed: parsed.parsed,
    parsedTaskId: parsed.parsedTaskId,
  };
}

export async function applyParsedTask(
  parsedTaskId: string,
  edited: {
    title: string;
    description: string;
    priority: string;
    dueAt: string;
    estimatedMinutes: string;
    assigneeIds: string[];
    subtasks: string[];
    labelIds?: string[];
  }
) {
  const ctx = await requirePermission("task.create");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const title = edited.title.trim();
  if (!title) return { error: "Title can't be empty" };

  const record = await prisma.aIParsedTask.findFirst({
    where: { id: parsedTaskId, organizationId: orgId, userId },
  });
  if (!record) return { error: "That draft expired" };

  const dueAt = fromLocalInput(edited.dueAt);

  const estimateRaw = edited.estimatedMinutes
    ? Number(edited.estimatedMinutes)
    : null;
  const estimate =
    estimateRaw !== null && Number.isFinite(estimateRaw) ? estimateRaw : null;

  const validMembers = await prisma.organizationMember.findMany({
    where: {
      organizationId: orgId,
      userId: { in: edited.assigneeIds.length ? edited.assigneeIds : [userId] },
      status: "ACTIVE",
    },
    select: { userId: true },
  });

  const assignees = validMembers.map((m) => m.userId);
  if (assignees.length === 0) assignees.push(userId);

  const parsed = record.parsedOutput as unknown as ParsedTask | null;

  const labelIds = edited.labelIds ?? [];
  const validLabels =
    labelIds.length > 0
      ? await prisma.label.findMany({
          where: { organizationId: orgId, id: { in: labelIds } },
          select: { id: true },
        })
      : [];

  const created = await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        organizationId: orgId,
        createdById: userId,
        title,
        description: edited.description.trim() || null,
        priority: edited.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
        priorityScore: computePriorityScore(edited.priority, dueAt),
        dueAt,
        estimatedMinutes: estimate,
        status: "TODO",
        source: "AI_PARSED",
        aiParsedTaskId: record.id,
        riskLevel: parsed?.riskLevel ?? "NONE",
        roadblock: parsed?.roadblock ?? null,
      },
    });

    await tx.taskAssignment.createMany({
      data: assignees.map((id, i) => ({
        organizationId: orgId,
        taskId: task.id,
        userId: id,
        role: i === 0 ? ("OWNER" as const) : ("COLLABORATOR" as const),
        assignedById: userId,
      })),
      skipDuplicates: true,
    });

    if (validLabels.length > 0) {
      await tx.taskLabel.createMany({
        data: validLabels.map((l) => ({
          organizationId: orgId,
          taskId: task.id,
          labelId: l.id,
        })),
        skipDuplicates: true,
      });
    }

    const subtasks = edited.subtasks.map((s) => s.trim()).filter(Boolean);
    if (subtasks.length > 0) {
      await tx.task.createMany({
        data: subtasks.map((sub, i) => ({
          organizationId: orgId,
          createdById: userId,
          parentTaskId: task.id,
          title: sub,
          status: "TODO" as const,
          priority: "MEDIUM" as const,
          position: i,
          source: "AI_PARSED" as const,
        })),
      });
    }

    await tx.aIParsedTask.update({
      where: { id: record.id },
      data: { status: "APPLIED", appliedAt: new Date() },
    });

    await tx.activityLog.create({
      data: {
        organizationId: orgId,
        userId,
        action: "task.created_from_ai",
        entityType: "Task",
        entityId: task.id,
        metadata: { title, parsedTaskId: record.id },
      },
    });

    const others = assignees.filter((id) => id !== userId);
    if (others.length > 0) {
      await tx.notification.createMany({
        data: others.map((id) => ({
          organizationId: orgId,
          userId: id,
          type: "TASK_ASSIGNED" as const,
          title: "New task assigned",
          body: title,
          taskId: task.id,
        })),
      });
    }

    return task.id;
  });

  revalidatePath("/tasks");
  revalidatePath("/");
  revalidatePath("/calendar");
  // Returned so the composer can attach a voice note to the row it just made.
  return { ok: true, taskId: created };
}

export async function discardParsedTask(parsedTaskId: string) {
  const ctx = await requirePermission("ai.use");

  await prisma.aIParsedTask.updateMany({
    where: {
      id: parsedTaskId,
      organizationId: ctx.membership!.organizationId,
      userId: ctx.session.user.id,
    },
    data: { status: "REJECTED" },
  });

  return { ok: true };
}