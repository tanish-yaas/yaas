"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/rbac/guard";
import { parseTaskInput } from "@/server/services/ai-parser";
import { computePriorityScore } from "@/server/services/tasks";
import type { ParsedTask } from "@/lib/ai/schemas";

export async function parseTask(rawInput: string) {
  const ctx = await requirePermission("ai.use");

  return parseTaskInput({
    rawInput,
    orgId: ctx.membership!.organizationId,
    userId: ctx.session.user.id,
    timezone: ctx.profile?.timezone ?? "UTC",
  });
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

  const dueAt = edited.dueAt ? new Date(edited.dueAt) : null;
  const estimate = edited.estimatedMinutes
    ? Number(edited.estimatedMinutes)
    : null;

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

  await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        organizationId: orgId,
        createdById: userId,
        title,
        description: edited.description.trim() || null,
        priority: edited.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
        priorityScore: computePriorityScore(edited.priority, dueAt),
        dueAt,
        estimatedMinutes: Number.isFinite(estimate) ? estimate : null,
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
  });

  revalidatePath("/tasks");
  revalidatePath("/");
  return { ok: true };
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