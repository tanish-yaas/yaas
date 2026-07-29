"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/rbac/guard";
import { createTaskSchema, statusSchema } from "@/lib/validators/task";
import { computePriorityScore, canMutateTask } from "@/server/services/tasks";

function refresh() {
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function createTask(formData: FormData) {
  const ctx = await requirePermission("task.create");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const parsed = createTaskSchema.safeParse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    priority: formData.get("priority") ?? "MEDIUM",
    dueAt: formData.get("dueAt") ?? "",
    estimatedMinutes: formData.get("estimatedMinutes") || undefined,
    assigneeIds: formData.getAll("assigneeIds").map(String),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const d = parsed.data;
  const dueAt = d.dueAt ? new Date(d.dueAt) : null;

  const assigneeIds = d.assigneeIds.length > 0 ? d.assigneeIds : [userId];

  const validMembers = await prisma.organizationMember.findMany({
    where: {
      organizationId: orgId,
      userId: { in: assigneeIds },
      status: "ACTIVE",
    },
    select: { userId: true },
  });

  const finalAssignees = validMembers.map((m) => m.userId);
  if (finalAssignees.length === 0) finalAssignees.push(userId);

  await prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        organizationId: orgId,
        createdById: userId,
        title: d.title,
        description: d.description || null,
        priority: d.priority,
        priorityScore: computePriorityScore(d.priority, dueAt),
        dueAt,
        estimatedMinutes: d.estimatedMinutes ?? null,
        status: "TODO",
        source: "MANUAL",
      },
    });

    await tx.taskAssignment.createMany({
      data: finalAssignees.map((id, i) => ({
        organizationId: orgId,
        taskId: task.id,
        userId: id,
        role: i === 0 ? "OWNER" : "COLLABORATOR",
        assignedById: userId,
      })),
      skipDuplicates: true,
    });

    await tx.activityLog.create({
      data: {
        organizationId: orgId,
        userId,
        action: "task.created",
        entityType: "Task",
        entityId: task.id,
        metadata: { title: task.title },
      },
    });

    const others = finalAssignees.filter((id) => id !== userId);
    if (others.length > 0) {
      await tx.notification.createMany({
        data: others.map((id) => ({
          organizationId: orgId,
          userId: id,
          type: "TASK_ASSIGNED" as const,
          title: "New task assigned",
          body: task.title,
          taskId: task.id,
        })),
      });
    }
  });

  refresh();
  return { ok: true };
}

export async function setTaskStatus(taskId: string, nextStatus: string) {
  const ctx = await requirePermission("task.edit_own");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const status = statusSchema.safeParse(nextStatus);
  if (!status.success) return { error: "Unknown status" };

  const task = await canMutateTask(taskId, orgId, userId, ctx.permissions);
  if (!task) return { error: "Not allowed" };
  if (task.status === status.data) return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: {
        status: status.data,
        completedAt: status.data === "DONE" ? new Date() : null,
      },
    });

    await tx.taskStatusHistory.create({
      data: {
        organizationId: orgId,
        taskId,
        fromStatus: task.status,
        toStatus: status.data,
        changedById: userId,
      },
    });
  });

  refresh();
  return { ok: true };
}

export async function deleteTask(taskId: string) {
  const ctx = await requirePermission("task.delete_own");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const task = await canMutateTask(taskId, orgId, userId, ctx.permissions);
  if (!task) return { error: "Not allowed" };

  await prisma.task.update({
    where: { id: taskId },
    data: { deletedAt: new Date() },
  });

  refresh();
  return { ok: true };
}