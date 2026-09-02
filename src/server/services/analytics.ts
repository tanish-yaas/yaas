import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { buildTaskScope } from "@/server/services/tasks";
import {
  AGING_BUCKETS,
  PIPELINE_STATUSES,
  PRIORITIES,
  RANGE_DAYS,
  FUTURE_DAYS,
  type AnalyticsData,
  type AnalyticsScope,
  type Counted,
  type PersonStats,
  type RangeDays,
} from "@/components/analytics/types";
import {
  addDaysToKey,
  istDayKey,
  istKeyToDate,
  istTodayKey,
} from "@/lib/dates";

/** Rows read per query. Well past a real workspace's volume; a guard, not a page. */
const ROW_CAP = 5000;

/** What a task with no estimate is assumed to cost, matching services/intelligence.ts. */
const ASSUMED_MINUTES = 45;

/** Members this viewer may ask for a report about, given report.view_*. */
export async function analyticsMembers(
  orgId: string,
  userId: string,
  permissions: Set<string>
): Promise<{ userId: string; name: string }[]> {
  if (!permissions.has("report.view_any") && !permissions.has("report.view_team")) {
    return [];
  }

  // A team-level reporter sees their own teams' people, not the whole roster.
  let userIds: string[] | null = null;
  if (!permissions.has("report.view_any")) {
    const teams = await prisma.teamMember.findMany({
      where: { userId, organizationId: orgId },
      select: { teamId: true },
    });
    const teammates = await prisma.teamMember.findMany({
      where: {
        organizationId: orgId,
        teamId: { in: teams.map((t) => t.teamId) },
      },
      select: { userId: true },
    });
    userIds = [...new Set([userId, ...teammates.map((t) => t.userId)])];
  }

  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId: orgId,
      status: "ACTIVE",
      ...(userIds ? { userId: { in: userIds } } : {}),
    },
    select: {
      userId: true,
      user: {
        select: {
          name: true,
          email: true,
          profile: { select: { displayName: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return members.map((m) => ({
    userId: m.userId,
    name:
      m.user.profile?.displayName ?? m.user.name ?? m.user.email ?? "Member",
  }));
}

/** The scope the viewer asked for, or the widest one they are actually allowed. */
export function resolveScope(
  requested: { scope?: string; user?: string },
  permissions: Set<string>
): AnalyticsScope {
  const canSeeOthers =
    permissions.has("report.view_any") || permissions.has("report.view_team");

  if (!canSeeOthers) return { kind: "self" };
  if (requested.scope === "everyone") return { kind: "everyone" };
  if (requested.scope === "user" && requested.user) {
    return { kind: "user", userId: requested.user };
  }
  return { kind: "self" };
}

export function resolveRange(value: string | undefined): RangeDays {
  const n = Number(value);
  return (RANGE_DAYS as readonly number[]).includes(n) ? (n as RangeDays) : 30;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return Math.round(value * 10) / 10;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return (
    Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10
  );
}

/** Everything the analytics page draws, for one scope and one window. */
export async function getAnalytics(
  orgId: string,
  viewerId: string,
  permissions: Set<string>,
  options: { scope: AnalyticsScope; rangeDays: RangeDays }
): Promise<AnalyticsData> {
  const { scope, rangeDays } = options;

  // buildTaskScope is the authority on what this viewer may see at all. The
  // requested scope only ever narrows it further — a wider report permission
  // never widens which rows come back.
  const visible = await buildTaskScope(orgId, viewerId, permissions);

  const assignedTo = (userId: string): Prisma.TaskWhereInput => ({
    assignments: { some: { userId } },
  });

  const where: Prisma.TaskWhereInput =
    scope.kind === "self"
      ? { ...visible, ...assignedTo(viewerId) }
      : scope.kind === "user"
        ? { ...visible, ...assignedTo(scope.userId) }
        : visible;

  const todayKey = istTodayKey();
  const startOfToday = istKeyToDate(todayKey);
  const endOfToday = istKeyToDate(addDaysToKey(todayKey, 1));
  const endOfWeek = istKeyToDate(addDaysToKey(todayKey, 7));

  const rangeStartKey = addDaysToKey(todayKey, -(rangeDays - 1));
  const rangeStart = istKeyToDate(rangeStartKey);
  const previousStart = istKeyToDate(addDaysToKey(rangeStartKey, -rangeDays));

  const futureEndKey = addDaysToKey(todayKey, FUTURE_DAYS);
  const futureEnd = istKeyToDate(futureEndKey);

  const openStatuses: Prisma.TaskWhereInput = {
    status: { notIn: ["DONE", "CANCELLED"] },
  };

  // AND-nested, never spread. buildTaskScope's own OR is what keeps a viewer
  // inside their scope, and `{ ...where, OR: [...] }` would silently replace it
  // with the query's date filter — every task in the org, visible to anyone.
  const scoped = (...clauses: Prisma.TaskWhereInput[]): Prisma.TaskWhereInput => ({
    AND: [where, ...clauses],
  });

  const [openRows, windowRows, labelRows, memberRows] = await Promise.all([
    // Everything currently open — the "present" and "future" halves both read
    // from this one set rather than a dozen counts.
    prisma.task.findMany({
      where: scoped(openStatuses),
      take: ROW_CAP,
      select: {
        id: true,
        status: true,
        priority: true,
        dueAt: true,
        estimatedMinutes: true,
        source: true,
        assignments: { select: { userId: true } },
        labels: { select: { labelId: true } },
      },
    }),

    // Anything that moved in the window or the one before it — the "past" half.
    prisma.task.findMany({
      where: scoped({
        OR: [
          { createdAt: { gte: previousStart } },
          { completedAt: { gte: previousStart } },
        ],
      }),
      take: ROW_CAP,
      select: {
        id: true,
        status: true,
        createdAt: true,
        completedAt: true,
        dueAt: true,
        assignments: { select: { userId: true } },
        labels: { select: { labelId: true } },
      },
    }),

    prisma.label.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, color: true },
    }),

    scope.kind === "self"
      ? Promise.resolve([])
      : prisma.organizationMember.findMany({
          where: { organizationId: orgId, status: "ACTIVE" },
          select: {
            userId: true,
            user: {
              select: {
                name: true,
                email: true,
                image: true,
                profile: { select: { displayName: true, avatarUrl: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
  ]);

  // ---- Present --------------------------------------------------------------

  const overdueRows = openRows.filter((t) => t.dueAt && t.dueAt < startOfToday);

  const present = {
    open: openRows.length,
    overdue: overdueRows.length,
    dueToday: openRows.filter(
      (t) => t.dueAt && t.dueAt >= startOfToday && t.dueAt < endOfToday
    ).length,
    dueThisWeek: openRows.filter(
      (t) => t.dueAt && t.dueAt >= startOfToday && t.dueAt < endOfWeek
    ).length,
    blocked: openRows.filter((t) => t.status === "BLOCKED").length,
    unassigned: openRows.filter((t) => t.assignments.length === 0).length,
    noDueDate: openRows.filter((t) => t.dueAt === null).length,
  };

  // ---- Past -----------------------------------------------------------------

  const inWindow = (date: Date | null | undefined): boolean =>
    !!date && date >= rangeStart;

  const createdInWindow = windowRows.filter((t) => inWindow(t.createdAt));
  const createdBefore = windowRows.filter(
    (t) => t.createdAt >= previousStart && t.createdAt < rangeStart
  );

  const completedInWindow = windowRows.filter(
    (t) => t.status === "DONE" && inWindow(t.completedAt)
  );
  const completedBefore = windowRows.filter(
    (t) =>
      t.status === "DONE" &&
      !!t.completedAt &&
      t.completedAt >= previousStart &&
      t.completedAt < rangeStart
  );

  const punctuality = (rows: typeof completedInWindow) => {
    const withDeadline = rows.filter((t) => t.dueAt !== null);
    const onTime = withDeadline.filter(
      (t) => t.completedAt !== null && t.dueAt !== null && t.completedAt <= t.dueAt
    );
    return {
      withDeadline: withDeadline.length,
      onTime: onTime.length,
      rate: withDeadline.length > 0 ? onTime.length / withDeadline.length : null,
    };
  };

  const cycleHours = (rows: typeof completedInWindow) =>
    rows
      .filter((t) => t.completedAt !== null)
      .map((t) => (t.completedAt!.getTime() - t.createdAt.getTime()) / 3_600_000)
      .filter((h) => h >= 0);

  const windowPunctuality = punctuality(completedInWindow);
  const windowCycle = cycleHours(completedInWindow);
  const previousCycle = cycleHours(completedBefore);

  // Buckets seeded for every day so a quiet day is a zero, not a gap in the line.
  const throughput = Array.from({ length: rangeDays }, (_, i) => ({
    dayKey: addDaysToKey(rangeStartKey, i),
    created: 0,
    completed: 0,
  }));
  const throughputIndex = new Map(throughput.map((d, i) => [d.dayKey, i]));

  for (const task of createdInWindow) {
    const i = throughputIndex.get(istDayKey(task.createdAt));
    if (i !== undefined) throughput[i].created += 1;
  }

  const byWeekday = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    completed: 0,
  }));

  for (const task of completedInWindow) {
    if (!task.completedAt) continue;
    const dayKey = istDayKey(task.completedAt);
    const i = throughputIndex.get(dayKey);
    if (i !== undefined) throughput[i].completed += 1;
    byWeekday[istKeyToDate(dayKey, 12).getUTCDay()].completed += 1;
  }

  // ---- Future ---------------------------------------------------------------

  const load = Array.from({ length: FUTURE_DAYS }, (_, i) => ({
    dayKey: addDaysToKey(todayKey, i),
    count: 0,
    minutes: 0,
  }));
  const loadIndex = new Map(load.map((d, i) => [d.dayKey, i]));

  let beyondWindow = 0;
  for (const task of openRows) {
    if (!task.dueAt || task.dueAt < startOfToday) continue;
    if (task.dueAt >= futureEnd) {
      beyondWindow += 1;
      continue;
    }
    const i = loadIndex.get(istDayKey(task.dueAt));
    if (i === undefined) continue;
    load[i].count += 1;
    load[i].minutes += task.estimatedMinutes ?? ASSUMED_MINUTES;
  }

  // Due inside three days and nothing has started on it yet — or it is stuck.
  const riskCutoff = istKeyToDate(addDaysToKey(todayKey, 3));
  const atRisk = openRows.filter(
    (t) =>
      t.dueAt !== null &&
      t.dueAt >= startOfToday &&
      t.dueAt < riskCutoff &&
      (t.status === "BACKLOG" || t.status === "TODO" || t.status === "BLOCKED")
  ).length;

  // ---- Distributions --------------------------------------------------------

  const countBy = <T>(
    rows: T[],
    keys: readonly string[],
    pick: (row: T) => string,
    label: (key: string) => string
  ): Counted[] => {
    const tally = new Map(keys.map((k) => [k, 0]));
    for (const row of rows) {
      const key = pick(row);
      if (tally.has(key)) tally.set(key, tally.get(key)! + 1);
    }
    return keys.map((key) => ({
      key,
      label: label(key),
      count: tally.get(key) ?? 0,
    }));
  };

  const titleCase = (value: string) =>
    value
      .split("_")
      .map((w) => w[0] + w.slice(1).toLowerCase())
      .join(" ");

  const pipeline = countBy(
    openRows,
    PIPELINE_STATUSES,
    (t) => t.status,
    titleCase
  );
  // Blocked is a state, not a pipeline stage — it rides along at the end so the
  // mix still adds up to every open task.
  pipeline.push({
    key: "BLOCKED",
    label: "Blocked",
    count: present.blocked,
  });

  const priority = countBy(openRows, PRIORITIES, (t) => t.priority, titleCase);

  const aging = AGING_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: overdueRows.filter((t) => {
      const days = Math.floor(
        (startOfToday.getTime() - t.dueAt!.getTime()) / 86_400_000
      );
      return days >= bucket.min && days <= bucket.max;
    }).length,
  }));

  const sourceTally = new Map<string, number>();
  for (const task of openRows) {
    sourceTally.set(task.source, (sourceTally.get(task.source) ?? 0) + 1);
  }
  const sources = [...sourceTally.entries()]
    .map(([key, count]) => ({ key, label: titleCase(key), count }))
    .sort((a, b) => b.count - a.count);

  const labelById = new Map(labelRows.map((l) => [l.id, l]));
  const labelTally = new Map<string, { open: number; done: number }>();
  const bumpLabel = (labelId: string, field: "open" | "done") => {
    const entry = labelTally.get(labelId) ?? { open: 0, done: 0 };
    entry[field] += 1;
    labelTally.set(labelId, entry);
  };
  for (const task of openRows) {
    for (const l of task.labels) bumpLabel(l.labelId, "open");
  }
  for (const task of completedInWindow) {
    for (const l of task.labels) bumpLabel(l.labelId, "done");
  }

  const labels = [...labelTally.entries()]
    .flatMap(([id, counts]) => {
      const label = labelById.get(id);
      return label ? [{ ...label, ...counts }] : [];
    })
    .sort((a, b) => b.open + b.done - (a.open + a.done))
    .slice(0, 8);

  // ---- People ---------------------------------------------------------------

  let people: PersonStats[] | null = null;

  if (scope.kind !== "self" && memberRows.length > 0) {
    const stats = new Map<string, PersonStats>();

    for (const member of memberRows) {
      stats.set(member.userId, {
        userId: member.userId,
        name:
          member.user.profile?.displayName ??
          member.user.name ??
          member.user.email ??
          "Member",
        avatarUrl: member.user.profile?.avatarUrl ?? null,
        image: member.user.image ?? null,
        open: 0,
        overdue: 0,
        completed: 0,
        onTimeRate: null,
        medianCycleHours: null,
        dueThisWeek: 0,
      });
    }

    const perPerson = new Map<
      string,
      { cycle: number[]; onTime: number; withDeadline: number }
    >();
    const bucketFor = (userId: string) => {
      const entry = perPerson.get(userId) ?? {
        cycle: [],
        onTime: 0,
        withDeadline: 0,
      };
      perPerson.set(userId, entry);
      return entry;
    };

    for (const task of openRows) {
      for (const a of task.assignments) {
        const row = stats.get(a.userId);
        if (!row) continue;
        row.open += 1;
        if (task.dueAt && task.dueAt < startOfToday) row.overdue += 1;
        if (task.dueAt && task.dueAt >= startOfToday && task.dueAt < endOfWeek) {
          row.dueThisWeek += 1;
        }
      }
    }

    for (const task of completedInWindow) {
      for (const a of task.assignments) {
        const row = stats.get(a.userId);
        if (!row) continue;
        row.completed += 1;

        const bucket = bucketFor(a.userId);
        if (task.completedAt) {
          const hours =
            (task.completedAt.getTime() - task.createdAt.getTime()) / 3_600_000;
          if (hours >= 0) bucket.cycle.push(hours);
        }
        if (task.dueAt) {
          bucket.withDeadline += 1;
          if (task.completedAt && task.completedAt <= task.dueAt) {
            bucket.onTime += 1;
          }
        }
      }
    }

    for (const [userId, bucket] of perPerson) {
      const row = stats.get(userId);
      if (!row) continue;
      row.medianCycleHours = median(bucket.cycle);
      row.onTimeRate =
        bucket.withDeadline > 0 ? bucket.onTime / bucket.withDeadline : null;
    }

    // Nobody with nothing to show — an empty row is a distraction, not a datum.
    people = [...stats.values()]
      .filter((p) => p.open > 0 || p.completed > 0)
      .sort((a, b) => b.open + b.completed - (a.open + a.completed));
  }

  return {
    todayKey,
    rangeDays,
    scope,
    present,
    past: {
      created: createdInWindow.length,
      completed: completedInWindow.length,
      onTime: windowPunctuality.onTime,
      withDeadline: windowPunctuality.withDeadline,
      onTimeRate: windowPunctuality.rate,
      medianCycleHours: median(windowCycle),
      avgCycleHours: mean(windowCycle),
      previous: {
        created: createdBefore.length,
        completed: completedBefore.length,
        onTimeRate: punctuality(completedBefore).rate,
        medianCycleHours: median(previousCycle),
      },
      throughput,
      byWeekday,
    },
    future: {
      load,
      beyondWindow,
      unscheduled: present.noDueDate,
      atRisk,
      estimatedHours:
        Math.round((load.reduce((sum, d) => sum + d.minutes, 0) / 60) * 10) / 10,
    },
    pipeline,
    priority,
    aging,
    labels,
    sources,
    people,
  };
}
