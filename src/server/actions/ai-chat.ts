"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/rbac/guard";
import { runChat, type ChatTurn } from "@/server/services/ai-chat";
import { computePriorityScore, canMutateTask } from "@/server/services/tasks";
import type { Proposal } from "@/lib/ai/tools";

export async function sendChatMessage(
  conversationId: string,
  history: ChatTurn[],
  message: string
) {
  const ctx = await requirePermission("ai.use");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const trimmed = message.trim().slice(0, 2000);
  if (!trimmed) return { ok: false as const, error: "Type something first" };

  let conversation = conversationId
    ? await prisma.lLMConversation.findFirst({
        where: { id: conversationId, organizationId: orgId, userId },
      })
    : null;

  if (!conversation) {
    conversation = await prisma.lLMConversation.create({
      data: {
        organizationId: orgId,
        userId,
        model: (await import("@/config/ai")).AI_CONFIG.model,
        title: trimmed.slice(0, 60),
        purpose: "assistant",
      },
    });
  }

  await prisma.lLMMessage.create({
    data: {
      organizationId: orgId,
      conversationId: conversation.id,
      role: "USER",
      content: trimmed,
    },
  });

  const result = await runChat({
    ctx: {
      orgId,
      userId,
      timezone: ctx.profile?.timezone ?? "UTC",
      permissions: ctx.permissions,
    },
    history: history.slice(-10),
    message: trimmed,
  });

  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }

  await prisma.lLMMessage.create({
    data: {
      organizationId: orgId,
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: result.reply.text,
      toolCalls:
        result.reply.proposals.length > 0
          ? JSON.parse(JSON.stringify(result.reply.proposals))
          : undefined,
    },
  });

  return {
    ok: true as const,
    conversationId: conversation.id,
    text: result.reply.text,
    proposals: result.reply.proposals,
  };
}

export async function applyProposal(proposal: Proposal) {
  const ctx = await requirePermission("ai.use");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  if (proposal.kind === "create_task") {
    if (!ctx.permissions.has("task.create")) {
      return { ok: false as const, error: "You can't create tasks" };
    }

    const title = proposal.title.trim();
    if (!title) return { ok: false as const, error: "Empty title" };

    const dueAt = proposal.dueAt ? new Date(proposal.dueAt) : null;
    const validDue = dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null;

    const ids = proposal.assigneeIds.length ? proposal.assigneeIds : [userId];
    const valid = await prisma.organizationMember.findMany({
      where: { organizationId: orgId, userId: { in: ids }, status: "ACTIVE" },
      select: { userId: true },
    });

    const assignees = valid.map((m) => m.userId);
    if (assignees.length === 0) assignees.push(userId);

    await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          organizationId: orgId,
          createdById: userId,
          title,
          description: proposal.description.trim() || null,
          priority: proposal.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
          priorityScore: computePriorityScore(proposal.priority, validDue),
          dueAt: validDue,
          status: "TODO",
          source: "AI_PARSED",
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

      await tx.activityLog.create({
        data: {
          organizationId: orgId,
          userId,
          action: "task.created_from_assistant",
          entityType: "Task",
          entityId: task.id,
          metadata: { title },
        },
      });
    });

    revalidatePath("/tasks");
    revalidatePath("/");
    return { ok: true as const, applied: 1 };
  }

  // update_tasks
  let applied = 0;

  for (const taskId of proposal.taskIds.slice(0, 50)) {
    const task = await canMutateTask(taskId, orgId, userId, ctx.permissions);
    if (!task) continue;

    const data: Record<string, unknown> = {};

    if (proposal.status) {
      data.status = proposal.status;
      data.completedAt = proposal.status === "DONE" ? new Date() : null;
    }
    if (proposal.priority) {
      data.priority = proposal.priority;
    }
    if (proposal.dueAt) {
      const d = new Date(proposal.dueAt);
      if (!Number.isNaN(d.getTime())) data.dueAt = d;
    }

    if (Object.keys(data).length === 0) continue;

    const nextPriority = (data.priority as string) ?? task.priority;
    const nextDue = (data.dueAt as Date) ?? task.dueAt;
    data.priorityScore = computePriorityScore(nextPriority, nextDue);

    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id: taskId }, data });

      if (proposal.status && proposal.status !== task.status) {
        await tx.taskStatusHistory.create({
          data: {
            organizationId: orgId,
            taskId,
            fromStatus: task.status,
            toStatus: proposal.status as "TODO" | "DONE",
            changedById: userId,
            reason: "Applied from assistant",
          },
        });
      }
    });

    applied += 1;
  }

  revalidatePath("/tasks");
  revalidatePath("/");
  return { ok: true as const, applied };
}