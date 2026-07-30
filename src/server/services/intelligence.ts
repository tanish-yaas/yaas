import { prisma } from "@/lib/prisma";
import { computePriorityScore } from "@/server/services/tasks";

const DAY_MS = 86_400_000;
const SUGGESTION_TTL_DAYS = 7;

export type SuggestionPayload = {
  taskId?: string;
  apply?:
    | { action: "set_due"; dueAt: string }
    | { action: "set_priority_score"; score: number }
    | { action: "set_status"; status: string };
};

type Draft = {
  userId: string;
  taskId: string | null;
  type:
    | "TASK_PRIORITY"
    | "TASK_BREAKDOWN"
    | "SCHEDULE_SLOT"
    | "ROADBLOCK_RESOLUTION"
    | "WORKLOAD_REBALANCE"
    | "DEADLINE_ADJUSTMENT";
  reason: string;
  payload: SuggestionPayload;
  confidence: number;
};

function nextWorkingDay(from: Date, workingDays: number[]): Date {
  const d = new Date(from);
  d.setHours(10, 0, 0, 0);
  for (let i = 0; i < 14; i++) {
    d.setDate(d.getDate() + 1);
    if (workingDays.includes(d.getDay())) return d;
  }
  return d;
}

export async function runIntelligence(organizationId: string) {
  const now = new Date();
  const drafts: Draft[] = [];
  let rescored = 0;

  const members = await prisma.organizationMember.findMany({
    where: { organizationId, status: "ACTIVE" },
    include: { user: { include: { profile: true } } },
  });

  for (const member of members) {
    const userId = member.userId;
    const profile = member.user.profile;
    const workingDays = profile?.workingDays?.length
      ? profile.workingDays
      : [1, 2, 3, 4, 5];
    const capacityMinutes =
      ((profile?.workingHoursEnd ?? 17) - (profile?.workingHoursStart ?? 9)) * 60;

    const tasks = await prisma.task.findMany({
      where: {
        organizationId,
        deletedAt: null,
        status: { notIn: ["DONE", "CANCELLED"] },
        assignments: { some: { userId } },
      },
      include: { _count: { select: { subtasks: true } } },
    });

    // ---- 1. Recompute priority scores ----
    for (const task of tasks) {
      if (task.priorityPinned) continue;

      const fresh = computePriorityScore(task.priority, task.dueAt);
      if (Math.abs(fresh - task.priorityScore) < 0.5) continue;

      await prisma.$transaction(async (tx) => {
        await tx.task.update({
          where: { id: task.id },
          data: { priorityScore: fresh },
        });
        await tx.taskPriorityHistory.create({
          data: {
            organizationId,
            taskId: task.id,
            fromScore: task.priorityScore,
            toScore: fresh,
            changedByAI: true,
            reason: "Nightly recalculation",
          },
        });
      });

      rescored += 1;

      if (Math.abs(fresh - task.priorityScore) >= 20) {
        drafts.push({
          userId,
          taskId: task.id,
          type: "TASK_PRIORITY",
          reason: `"${task.title}" has climbed the queue as its deadline approaches.`,
          payload: { taskId: task.id },
          confidence: 0.9,
        });
      }
    }

    // ---- 2. Overdue work ----
    const overdue = tasks.filter((t) => t.dueAt && t.dueAt < now);
    for (const task of overdue.slice(0, 5)) {
      const daysLate = Math.floor((now.getTime() - task.dueAt!.getTime()) / DAY_MS);
      if (daysLate < 1) continue;

      const suggested = nextWorkingDay(now, workingDays);
      drafts.push({
        userId,
        taskId: task.id,
        type: "DEADLINE_ADJUSTMENT",
        reason: `"${task.title}" is ${daysLate} ${daysLate === 1 ? "day" : "days"} past its deadline. Move it or close it.`,
        payload: {
          taskId: task.id,
          apply: { action: "set_due", dueAt: suggested.toISOString() },
        },
        confidence: 0.85,
      });
    }

    // ---- 3. Overloaded days ----
    const byDay = new Map<string, { minutes: number; tasks: typeof tasks }>();
    for (const task of tasks) {
      if (!task.dueAt || task.dueAt < now) continue;
      const key = task.dueAt.toISOString().slice(0, 10);
      const entry = byDay.get(key) ?? { minutes: 0, tasks: [] };
      entry.minutes += task.estimatedMinutes ?? 45;
      entry.tasks.push(task);
      byDay.set(key, entry);
    }

    for (const [day, entry] of byDay) {
      if (entry.minutes <= capacityMinutes) continue;

      const lightest = [...entry.tasks].sort(
        (a, b) => a.priorityScore - b.priorityScore
      )[0];
      if (!lightest) continue;

      const overBy = Math.round((entry.minutes - capacityMinutes) / 60);
      const moveTo = nextWorkingDay(new Date(day), workingDays);

      drafts.push({
        userId,
        taskId: lightest.id,
        type: "WORKLOAD_REBALANCE",
        reason: `${new Date(day).toDateString().slice(0, 10)} is about ${overBy}h over capacity. Moving "${lightest.title}" would ease it.`,
        payload: {
          taskId: lightest.id,
          apply: { action: "set_due", dueAt: moveTo.toISOString() },
        },
        confidence: 0.7,
      });
    }

    // ---- 4. Stale blockers ----
    const blocked = tasks.filter(
      (t) =>
        t.status === "BLOCKED" &&
        now.getTime() - (t.roadblockAt ?? t.updatedAt).getTime() > 3 * DAY_MS
    );

    for (const task of blocked.slice(0, 3)) {
      const days = Math.floor(
        (now.getTime() - (task.roadblockAt ?? task.updatedAt).getTime()) / DAY_MS
      );
      drafts.push({
        userId,
        taskId: task.id,
        type: "ROADBLOCK_RESOLUTION",
        reason: `"${task.title}" has been blocked for ${days} days${task.roadblock ? ` — ${task.roadblock}` : ""}. Worth chasing.`,
        payload: {
          taskId: task.id,
          apply: { action: "set_status", status: "TODO" },
        },
        confidence: 0.8,
      });
    }

    // ---- 5. Tasks too big to start ----
    const oversized = tasks.filter(
      (t) => (t.estimatedMinutes ?? 0) >= 240 && t._count.subtasks === 0
    );

    for (const task of oversized.slice(0, 3)) {
      const hours = Math.round((task.estimatedMinutes ?? 0) / 60);
      drafts.push({
        userId,
        taskId: task.id,
        type: "TASK_BREAKDOWN",
        reason: `"${task.title}" is estimated at ${hours}h with no subtasks. Splitting it makes progress visible.`,
        payload: { taskId: task.id },
        confidence: 0.75,
      });
    }
  }

  // ---- Persist, skipping anything already pending ----
  const existing = await prisma.aISuggestion.findMany({
    where: { organizationId, status: "PENDING" },
    select: { userId: true, taskId: true, type: true },
  });

  const seen = new Set(
    existing.map((s) => `${s.userId}:${s.taskId ?? ""}:${s.type}`)
  );

  const expiresAt = new Date(now.getTime() + SUGGESTION_TTL_DAYS * DAY_MS);
  const fresh = drafts.filter((d) => {
    const key = `${d.userId}:${d.taskId ?? ""}:${d.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (fresh.length > 0) {
    await prisma.aISuggestion.createMany({
      data: fresh.map((d) => ({
        organizationId,
        userId: d.userId,
        taskId: d.taskId,
        type: d.type,
        reason: d.reason,
        payload: JSON.parse(JSON.stringify(d.payload)),
        confidence: d.confidence,
        model: "rules-v1",
        expiresAt,
      })),
    });
  }

  // ---- Expire stale ones ----
  const { count: expired } = await prisma.aISuggestion.updateMany({
    where: { organizationId, status: "PENDING", expiresAt: { lt: now } },
    data: { status: "EXPIRED" },
  });

  return { rescored, created: fresh.length, expired };
}