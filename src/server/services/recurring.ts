import { RRule } from "rrule";
import { prisma } from "@/lib/prisma";
import { IST_OFFSET_MS } from "@/lib/dates";
import { computePriorityScore } from "@/server/services/tasks";
import { APP_CONFIG } from "@/config/app";

export type RecurrenceInput =
  | { freq: "DAILY"; interval: number }
  | { freq: "WEEKLY"; interval: number; byWeekday: number[] }
  | { freq: "MONTHLY"; interval: number; byMonthDay: number };

export type RecurringTemplate = {
  description?: string | null;
  priority?: string;
  estimatedMinutes?: number | null;
  assigneeIds?: string[];
  labelIds?: string[];
};

/** rrule's weekday constants, indexed by JS getDay() (0 = Sunday). */
const WEEKDAYS = [
  RRule.SU,
  RRule.MO,
  RRule.TU,
  RRule.WE,
  RRule.TH,
  RRule.FR,
  RRule.SA,
];

const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Recurrence is reasoned about in IST wall-clock time. Shifting instants by the
 * fixed offset lets rrule — which works in UTC — produce IST-correct weekdays
 * and month days even for rules that fire before 05:30 IST.
 */
function toRuleFrame(instant: Date) {
  return new Date(instant.getTime() + IST_OFFSET_MS);
}

function fromRuleFrame(framed: Date) {
  return new Date(framed.getTime() - IST_OFFSET_MS);
}

export function buildRRule(input: RecurrenceInput): string {
  const interval = Math.max(1, Math.min(52, Math.round(input.interval)));

  if (input.freq === "DAILY") {
    return new RRule({ freq: RRule.DAILY, interval }).toString().replace(/^RRULE:/, "");
  }

  if (input.freq === "WEEKLY") {
    const days = [...new Set(input.byWeekday)]
      .filter((d) => d >= 0 && d <= 6)
      .map((d) => WEEKDAYS[d]);

    return new RRule({
      freq: RRule.WEEKLY,
      interval,
      byweekday: days.length > 0 ? days : undefined,
    })
      .toString()
      .replace(/^RRULE:/, "");
  }

  const day = Math.max(1, Math.min(31, Math.round(input.byMonthDay)));
  return new RRule({ freq: RRule.MONTHLY, interval, bymonthday: [day] })
    .toString()
    .replace(/^RRULE:/, "");
}

function parseRule(rrule: string, startsAt: Date): RRule | null {
  try {
    const options = RRule.parseString(
      rrule.startsWith("RRULE:") ? rrule : `RRULE:${rrule}`
    );
    return new RRule({ ...options, dtstart: toRuleFrame(startsAt) });
  } catch {
    return null;
  }
}

/** First occurrence strictly after `after`, or null once the series ends. */
export function nextOccurrence(
  rrule: string,
  startsAt: Date,
  after: Date,
  endsAt?: Date | null
): Date | null {
  const rule = parseRule(rrule, startsAt);
  if (!rule) return null;

  const framed = rule.after(toRuleFrame(after), false);
  if (!framed) return null;

  const next = fromRuleFrame(framed);
  if (endsAt && next > endsAt) return null;

  return next;
}

/** The first run of a brand new series: the start itself if it matches. */
export function firstOccurrence(
  rrule: string,
  startsAt: Date,
  endsAt?: Date | null
): Date | null {
  const rule = parseRule(rrule, startsAt);
  if (!rule) return null;

  const framed = rule.after(toRuleFrame(startsAt), true);
  if (!framed) return null;

  const first = fromRuleFrame(framed);
  if (endsAt && first > endsAt) return null;

  return first;
}

export function describeRRule(rrule: string): string {
  try {
    const options = RRule.parseString(
      rrule.startsWith("RRULE:") ? rrule : `RRULE:${rrule}`
    );

    const interval = options.interval ?? 1;

    if (options.freq === RRule.DAILY) {
      return interval === 1 ? "Every day" : `Every ${interval} days`;
    }

    if (options.freq === RRule.WEEKLY) {
      const raw = options.byweekday;
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];

      const days = list
        .map((d) => {
          const weekday = typeof d === "number" ? d : (d as { weekday: number }).weekday;
          // rrule counts Monday as 0; JS counts Sunday as 0.
          return WEEKDAY_LABEL[(weekday + 1) % 7];
        })
        .join(", ");

      const every = interval === 1 ? "Every week" : `Every ${interval} weeks`;
      return days ? `${every} on ${days}` : every;
    }

    if (options.freq === RRule.MONTHLY) {
      const raw = options.bymonthday;
      const day = Array.isArray(raw) ? raw[0] : raw;
      const every = interval === 1 ? "Every month" : `Every ${interval} months`;
      return day ? `${every} on day ${day}` : every;
    }

    return rrule;
  } catch {
    return rrule;
  }
}

/**
 * Materialise every recurring task that has come due, then wind its schedule
 * forward. Runs from the cron route.
 *
 * `lookaheadMs` pulls runs forward that are due before the *next* cron tick.
 * On a once-a-day schedule that matters: without it, a task set for 09:00
 * would not be created until the following night's run, arriving a day late
 * with its deadline already in the past. The created task still carries its
 * scheduled time as `dueAt` — only its creation happens early.
 */
export async function processRecurringTasks(limit = 50, lookaheadMs = 0) {
  const now = new Date();
  const horizon = new Date(now.getTime() + Math.max(0, lookaheadMs));

  const due = await prisma.recurringTask.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      nextRunAt: { lte: horizon },
    },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });

  let created = 0;
  let deactivated = 0;

  for (const recurring of due) {
    const template = (recurring.template ?? {}) as RecurringTemplate;

    const assigneeIds = [
      ...new Set(
        [
          ...(template.assigneeIds ?? []),
          ...(recurring.assigneeId ? [recurring.assigneeId] : []),
        ].filter(Boolean)
      ),
    ];

    const activeAssignees = await prisma.organizationMember.findMany({
      where: {
        organizationId: recurring.organizationId,
        userId: { in: assigneeIds.length > 0 ? assigneeIds : [recurring.ownerId] },
        status: "ACTIVE",
      },
      select: { userId: true },
    });

    const finalAssignees = activeAssignees.map((m) => m.userId);
    if (finalAssignees.length === 0) finalAssignees.push(recurring.ownerId);

    const priority = (template.priority ?? "MEDIUM") as
      | "LOW"
      | "MEDIUM"
      | "HIGH"
      | "URGENT";

    const dueAt = recurring.nextRunAt ?? now;

    await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          organizationId: recurring.organizationId,
          createdById: recurring.ownerId,
          title: recurring.title,
          description: recurring.description ?? template.description ?? null,
          priority,
          priorityScore: computePriorityScore(priority, dueAt),
          dueAt,
          estimatedMinutes: template.estimatedMinutes ?? null,
          status: "TODO",
          source: "RECURRING",
          recurringTaskId: recurring.id,
        },
      });

      await tx.taskAssignment.createMany({
        data: finalAssignees.map((userId, i) => ({
          organizationId: recurring.organizationId,
          taskId: task.id,
          userId,
          role: i === 0 ? ("OWNER" as const) : ("COLLABORATOR" as const),
          assignedById: recurring.ownerId,
        })),
        skipDuplicates: true,
      });

      if (template.labelIds && template.labelIds.length > 0) {
        const labels = await tx.label.findMany({
          where: {
            organizationId: recurring.organizationId,
            id: { in: template.labelIds },
          },
          select: { id: true },
        });

        if (labels.length > 0) {
          await tx.taskLabel.createMany({
            data: labels.map((l) => ({
              organizationId: recurring.organizationId,
              taskId: task.id,
              labelId: l.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      await tx.notification.createMany({
        data: finalAssignees.map((userId) => ({
          organizationId: recurring.organizationId,
          userId,
          type: "TASK_ASSIGNED" as const,
          title: "Recurring task due",
          body: recurring.title,
          taskId: task.id,
        })),
      });

      await tx.activityLog.create({
        data: {
          organizationId: recurring.organizationId,
          userId: recurring.ownerId,
          action: "task.created_from_recurrence",
          entityType: "Task",
          entityId: task.id,
          metadata: { recurringTaskId: recurring.id, title: recurring.title },
        },
      });
    });

    created += 1;

    const next = nextOccurrence(
      recurring.rrule,
      recurring.startsAt,
      dueAt,
      recurring.endsAt
    );

    if (!next) deactivated += 1;

    await prisma.recurringTask.update({
      where: { id: recurring.id },
      data: {
        lastRunAt: now,
        nextRunAt: next,
        runCount: { increment: 1 },
        isActive: next !== null,
      },
    });
  }

  return { processed: due.length, created, deactivated };
}

/** Series created before nextRunAt existed, or reactivated ones. */
export async function backfillNextRunAt() {
  const pending = await prisma.recurringTask.findMany({
    where: { isActive: true, deletedAt: null, nextRunAt: null },
  });

  for (const recurring of pending) {
    const next = nextOccurrence(
      recurring.rrule,
      recurring.startsAt,
      new Date(),
      recurring.endsAt
    );

    await prisma.recurringTask.update({
      where: { id: recurring.id },
      data: { nextRunAt: next, isActive: next !== null },
    });
  }

  return pending.length;
}

export const RECURRING_TIMEZONE = APP_CONFIG.timezone;
