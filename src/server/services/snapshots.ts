import { prisma } from "@/lib/prisma";
import { addDaysToKey, istDayKey, istKeyToDate } from "@/lib/dates";

/**
 * Extras the ProductivitySnapshot table has no column for. Kept in `breakdown`
 * rather than migrating the schema.
 */
export type SnapshotBreakdown = {
  score: number;
  avgCompletionHours: number | null;
  completedOnTime: number;
  completedWithDeadline: number;
};

/**
 * A single 0–100 read on a day's work.
 *
 *   45  finishing what was due
 *   25  finishing it before the deadline
 *   20  throughput, saturating at five tasks
 *   10  carrying no overdue backlog
 */
export function computeScore(input: {
  completionRate: number;
  onTimeRate: number | null;
  tasksCompleted: number;
  tasksOverdue: number;
}): number {
  const completion = 45 * clamp01(input.completionRate);
  const onTime = 25 * clamp01(input.onTimeRate ?? 1);
  const throughput = 20 * Math.min(1, input.tasksCompleted / 5);
  const backlog = 10 * (1 - Math.min(1, input.tasksOverdue / 5));

  return Math.round(
    Math.max(0, Math.min(100, completion + onTime + throughput + backlog))
  );
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** The @db.Date column stores a bare calendar day. */
function dateColumn(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export async function buildSnapshotsForDay(dayKey: string) {
  const dayStart = istKeyToDate(dayKey);
  const dayEnd = istKeyToDate(addDaysToKey(dayKey, 1));

  const members = await prisma.organizationMember.findMany({
    where: { status: "ACTIVE" },
    select: { organizationId: true, userId: true },
  });

  let written = 0;

  for (const member of members) {
    const { organizationId, userId } = member;

    const mine = {
      organizationId,
      deletedAt: null,
      assignments: { some: { userId } },
    };

    const [created, completed, dueThatDay, overdue, blocked, events] =
      await Promise.all([
        prisma.task.count({
          where: {
            organizationId,
            deletedAt: null,
            createdById: userId,
            createdAt: { gte: dayStart, lt: dayEnd },
          },
        }),
        prisma.task.findMany({
          where: {
            ...mine,
            status: "DONE",
            completedAt: { gte: dayStart, lt: dayEnd },
          },
          select: {
            createdAt: true,
            completedAt: true,
            dueAt: true,
            estimatedMinutes: true,
            priorityScore: true,
          },
        }),
        prisma.task.count({
          where: { ...mine, dueAt: { gte: dayStart, lt: dayEnd } },
        }),
        prisma.task.count({
          where: {
            ...mine,
            dueAt: { lt: dayEnd },
            status: { notIn: ["DONE", "CANCELLED"] },
          },
        }),
        prisma.task.count({ where: { ...mine, status: "BLOCKED" } }),
        prisma.calendarEvent.findMany({
          where: {
            organizationId,
            deletedAt: null,
            busy: true,
            allDay: false,
            startAt: { lt: dayEnd },
            endAt: { gt: dayStart },
            calendar: { ownerId: userId },
          },
          select: { startAt: true, endAt: true },
        }),
      ]);

    // Nothing happened and nothing was pending — no snapshot worth keeping.
    if (
      created === 0 &&
      completed.length === 0 &&
      dueThatDay === 0 &&
      overdue === 0 &&
      events.length === 0
    ) {
      continue;
    }

    const completionRate =
      dueThatDay > 0
        ? Math.min(1, completed.length / dueThatDay)
        : completed.length > 0
          ? 1
          : 0;

    const withDeadline = completed.filter((t) => t.dueAt !== null);
    const onTime = withDeadline.filter(
      (t) => t.completedAt !== null && t.dueAt !== null && t.completedAt <= t.dueAt
    );
    const onTimeRate =
      withDeadline.length > 0 ? onTime.length / withDeadline.length : null;

    const completionHours = completed
      .filter((t) => t.completedAt !== null)
      .map(
        (t) =>
          (t.completedAt!.getTime() - t.createdAt.getTime()) / 3_600_000
      )
      .filter((h) => h >= 0);

    const avgCompletionHours =
      completionHours.length > 0
        ? Math.round(
            (completionHours.reduce((sum, h) => sum + h, 0) /
              completionHours.length) *
              10
          ) / 10
        : null;

    const focusMinutes = completed.reduce(
      (sum, t) => sum + (t.estimatedMinutes ?? 0),
      0
    );

    const meetingMinutes = Math.round(
      events.reduce((sum, e) => {
        const start = Math.max(e.startAt.getTime(), dayStart.getTime());
        const end = Math.min(e.endAt.getTime(), dayEnd.getTime());
        return sum + Math.max(0, end - start) / 60_000;
      }, 0)
    );

    const avgPriorityScore =
      completed.length > 0
        ? Math.round(
            (completed.reduce((sum, t) => sum + t.priorityScore, 0) /
              completed.length) *
              10
          ) / 10
        : null;

    const score = computeScore({
      completionRate,
      onTimeRate,
      tasksCompleted: completed.length,
      tasksOverdue: overdue,
    });

    const breakdown: SnapshotBreakdown = {
      score,
      avgCompletionHours,
      completedOnTime: onTime.length,
      completedWithDeadline: withDeadline.length,
    };

    const payload = {
      organizationId,
      tasksCreated: created,
      tasksCompleted: completed.length,
      tasksOverdue: overdue,
      tasksBlocked: blocked,
      completionRate,
      focusMinutes,
      meetingMinutes,
      avgPriorityScore,
      onTimeRate,
      breakdown,
    };

    await prisma.productivitySnapshot.upsert({
      where: { userId_date: { userId, date: dateColumn(dayKey) } },
      update: payload,
      create: { ...payload, userId, date: dateColumn(dayKey) },
    });

    written += 1;
  }

  return { day: dayKey, members: members.length, written };
}

/** Yesterday in IST — the last day that has actually finished. */
export function previousDayKey(): string {
  return addDaysToKey(istDayKey(new Date()), -1);
}

export type ScoreTrend = {
  latest: number | null;
  average: number | null;
  previousAverage: number | null;
  change: number | null;
  points: { dayKey: string; score: number | null }[];
};

/** The last `days` days of scores, oldest first, with gaps left as null. */
export async function getScoreTrend(
  userId: string,
  days = 14
): Promise<ScoreTrend> {
  const endKey = istDayKey(new Date());
  const startKey = addDaysToKey(endKey, -(days - 1));

  const rows = await prisma.productivitySnapshot.findMany({
    where: {
      userId,
      date: { gte: dateColumn(startKey), lte: dateColumn(endKey) },
    },
    orderBy: { date: "asc" },
    select: { date: true, breakdown: true, completionRate: true },
  });

  const byDay = new Map<string, number>();
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10);
    const breakdown = row.breakdown as SnapshotBreakdown | null;
    const score =
      typeof breakdown?.score === "number"
        ? breakdown.score
        : Math.round(row.completionRate * 100);
    byDay.set(key, score);
  }

  const points = Array.from({ length: days }, (_, i) => {
    const dayKey = addDaysToKey(startKey, i);
    return { dayKey, score: byDay.get(dayKey) ?? null };
  });

  const scored = points.filter((p) => p.score !== null);
  const latest = scored.length > 0 ? scored[scored.length - 1].score : null;

  const half = Math.floor(days / 2);
  const recent = points.slice(half).filter((p) => p.score !== null);
  const earlier = points.slice(0, half).filter((p) => p.score !== null);

  const mean = (list: { score: number | null }[]) =>
    list.length > 0
      ? Math.round(
          list.reduce((sum, p) => sum + (p.score ?? 0), 0) / list.length
        )
      : null;

  const average = mean(recent);
  const previousAverage = mean(earlier);

  return {
    latest,
    average,
    previousAverage,
    change:
      average !== null && previousAverage !== null
        ? average - previousAverage
        : null,
    points,
  };
}
