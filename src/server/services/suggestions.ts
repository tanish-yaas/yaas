"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireContext } from "@/server/rbac/guard";
import { canMutateTask, computePriorityScore } from "@/server/services/tasks";
import type { SuggestionPayload } from "@/server/services/intelligence";

export async function acceptSuggestion(suggestionId: string) {
  const ctx = await requireContext();
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const suggestion = await prisma.aISuggestion.findFirst({
    where: {
      id: suggestionId,
      organizationId: orgId,
      userId,
      status: "PENDING",
    },
  });
  if (!suggestion) return { ok: false as const, error: "That suggestion is gone" };

  const payload = suggestion.payload as SuggestionPayload | null;
  const action = payload?.apply;

  if (action && payload?.taskId) {
    const task = await canMutateTask(payload.taskId, orgId, userId, ctx.permissions);
    if (!task) return { ok: false as const, error: "You can't edit that task" };

    const data: Record<string, unknown> = {};

    if (action.action === "set_due") {
      const d = new Date(action.dueAt);
      if (!Number.isNaN(d.getTime())) {
        data.dueAt = d;
        data.priorityScore = computePriorityScore(task.priority, d);
      }
    } else if (action.action === "set_priority_score") {
      data.priorityScore = action.score;
    } else if (action.action === "set_status") {
      data.status = action.status;
      data.roadblock = null;
      data.roadblockAt = null;
    }

    if (Object.keys(data).length > 0) {
      await prisma.task.update({ where: { id: payload.taskId }, data });
    }
  }

  await prisma.aISuggestion.update({
    where: { id: suggestionId },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });

  revalidatePath("/");
  revalidatePath("/tasks");
  return { ok: true as const };
}

export async function dismissSuggestion(suggestionId: string) {
  const ctx = await requireContext();

  await prisma.aISuggestion.updateMany({
    where: {
      id: suggestionId,
      organizationId: ctx.membership!.organizationId,
      userId: ctx.session.user.id,
      status: "PENDING",
    },
    data: { status: "DISMISSED", dismissedAt: new Date() },
  });

  revalidatePath("/");
  return { ok: true as const };
}