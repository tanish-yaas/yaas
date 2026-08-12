"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireContext } from "@/server/rbac/guard";
import {
  buildTaskScope,
  canMutateTask,
  computePriorityScore,
} from "@/server/services/tasks";
import { formatIST } from "@/lib/dates";
import type { SuggestionPayload } from "@/server/services/intelligence";

export type SuggestionTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueLabel: string | null;
  overdue: boolean;
  roadblock: string | null;
  assignees: string[];
  labels: { id: string; name: string; color: string }[];
  subtaskCount: number;
  doneSubtaskCount: number;
};

export type SuggestionDetail = {
  id: string;
  type: string;
  reason: string;
  confidence: number | null;
  createdAt: string;
  /** Plain-English description of what accepting will change, if anything. */
  effect: string | null;
  actionable: boolean;
  task: SuggestionTask | null;
  /** True when the suggestion names a task the viewer isn't allowed to see. */
  taskHidden: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  IN_REVIEW: "In review",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

/** What "Do it" will actually write, spelled out before the user commits. */
function describeEffect(payload: SuggestionPayload | null): string | null {
  const action = payload?.apply;
  if (!action) return null;

  if (action.action === "set_due") {
    const due = new Date(action.dueAt);
    if (Number.isNaN(due.getTime())) return null;
    const when = formatIST(due, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Moves the due date to ${when}`;
  }

  if (action.action === "set_priority_score") {
    return `Sets the priority score to ${Math.round(action.score)}`;
  }

  if (action.action === "set_status") {
    return `Marks it ${STATUS_LABEL[action.status] ?? action.status}`;
  }

  return null;
}

/**
 * Everything the suggestion card needs to be worth opening: the full reason,
 * what accepting would change, and the task it is about.
 *
 * The task is fetched through buildTaskScope rather than by id alone. A
 * suggestion belongs to one user, but its taskId is just a column — scoping the
 * read keeps this from becoming a way to look up a task the viewer's role does
 * not reach.
 */
export async function getSuggestionDetail(
  suggestionId: string
): Promise<
  { ok: true; detail: SuggestionDetail } | { ok: false; error: string }
> {
  const ctx = await requireContext();
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const suggestion = await prisma.aISuggestion.findFirst({
    where: { id: suggestionId, organizationId: orgId, userId },
  });

  if (!suggestion) return { ok: false as const, error: "That suggestion is gone" };

  const payload = suggestion.payload as SuggestionPayload | null;
  const taskId = suggestion.taskId ?? payload?.taskId ?? null;

  let task: SuggestionTask | null = null;
  let taskHidden = false;

  if (taskId) {
    const scope = await buildTaskScope(orgId, userId, ctx.permissions);
    const row = await prisma.task.findFirst({
      where: { ...scope, id: taskId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueAt: true,
        roadblock: true,
        assignments: { select: { user: { select: { name: true } } } },
        labels: {
          select: { label: { select: { id: true, name: true, color: true } } },
        },
        subtasks: { where: { deletedAt: null }, select: { status: true } },
      },
    });

    if (row) {
      task = {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        // Formatted server-side: the app is pinned to IST and the browser is
        // not, so formatting in the sheet would drift.
        dueLabel: formatIST(row.dueAt, {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        overdue: !!row.dueAt && row.dueAt < new Date() && row.status !== "DONE",
        roadblock: row.roadblock,
        assignees: row.assignments
          .map((a) => a.user.name ?? "")
          .filter(Boolean),
        labels: row.labels.map((tl) => tl.label),
        subtaskCount: row.subtasks.length,
        doneSubtaskCount: row.subtasks.filter((s) => s.status === "DONE").length,
      };
    } else {
      taskHidden = true;
    }
  }

  return {
    ok: true as const,
    detail: {
      id: suggestion.id,
      type: suggestion.type,
      reason: suggestion.reason ?? "",
      confidence: suggestion.confidence,
      createdAt: suggestion.createdAt.toISOString(),
      effect: describeEffect(payload),
      actionable: !!payload?.apply && suggestion.status === "PENDING",
      task,
      taskHidden,
    },
  };
}

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
    const task = await canMutateTask(
      payload.taskId,
      orgId,
      userId,
      ctx.permissions
    );
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