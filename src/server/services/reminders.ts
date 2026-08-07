import { prisma } from "@/lib/prisma";
import { getWhatsAppProvider } from "@/lib/whatsapp/provider";
import { sendSlackToEmail } from "@/lib/slack/provider";
import { getScoreTrend } from "@/server/services/snapshots";
import {
  addDaysToKey,
  daysBetweenKeys,
  istDayKey,
  istKeyToDate,
  istTodayKey,
} from "@/lib/dates";

const WINDOW_MS = 24 * 60 * 60 * 1000;

function zoneOffset(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = dtf.formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );

  return asUTC - date.getTime();
}

function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = zoneOffset(new Date(guess), timeZone);
  return new Date(guess - offset);
}

export function computeNextSendAt(
  timeOfDay: string,
  timeZone: string,
  daysOfWeek: number[],
  after: Date = new Date()
): Date | null {
  const [hourStr, minuteStr] = timeOfDay.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (daysOfWeek.length === 0) return null;

  for (let i = 0; i < 9; i++) {
    const probe = new Date(after.getTime() + i * 86_400_000);

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(probe);

    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";

    const candidate = localToUtc(
      Number(get("year")),
      Number(get("month")),
      Number(get("day")),
      hour,
      minute,
      timeZone
    );

    if (candidate <= after) continue;

    const dayName = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    }).format(candidate);

    const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      dayName
    );

    if (daysOfWeek.includes(index)) return candidate;
  }

  return null;
}

async function isServiceWindowOpen(whatsappNumber: string): Promise<boolean> {
  const recent = await prisma.whatsAppMessage.findFirst({
    where: {
      fromNumber: whatsappNumber,
      direction: "INBOUND",
      createdAt: { gte: new Date(Date.now() - WINDOW_MS) },
    },
    select: { id: true },
  });
  return !!recent;
}

type DigestKind = "MORNING_DIGEST" | "EVENING_REVIEW" | "WEEKLY_REVIEW";

/** Only the sharp end gets called out — MEDIUM and LOW would be noise. */
const PRIORITY_TAG: Record<string, string> = {
  URGENT: " — urgent",
  HIGH: " — high",
};

type DigestTask = {
  title: string;
  dueAt: Date | null;
  priority: string;
};

/** "• 14:00 · Call Mukesh — high", or "• Anytime · …" when the task has no due time. */
function taskLine(task: DigestTask, timeFmt: Intl.DateTimeFormat): string {
  const when = task.dueAt ? timeFmt.format(task.dueAt) : "Anytime";
  return `• ${when} · ${task.title}${PRIORITY_TAG[task.priority] ?? ""}`;
}

async function buildDigest(
  kind: DigestKind,
  orgId: string,
  userId: string,
  timeZone: string,
  displayName: string
): Promise<{ title: string; body: string } | null> {
  const now = new Date();

  // Day boundaries have to be IST wall-clock, not the server's. The server runs
  // in UTC, so setHours(0,0,0,0) would put "today" at 05:30–05:30 IST.
  const todayKey = istTodayKey();
  const startOfDay = istKeyToDate(todayKey);
  const endOfDay = istKeyToDate(addDaysToKey(todayKey, 1));
  const endOfTomorrow = istKeyToDate(addDaysToKey(todayKey, 2));

  const mine = {
    organizationId: orgId,
    deletedAt: null,
    assignments: { some: { userId } },
  };

  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });

  const firstName = displayName.split(" ")[0];

  if (kind === "MORNING_DIGEST") {
    const [dueToday, dueCount, overdue, overdueCount, events] =
      await Promise.all([
        prisma.task.findMany({
          where: {
            ...mine,
            dueAt: { gte: startOfDay, lt: endOfDay },
            status: { notIn: ["DONE", "CANCELLED"] },
          },
          orderBy: { dueAt: "asc" },
          take: 10,
          select: { title: true, dueAt: true, priority: true },
        }),
        prisma.task.count({
          where: {
            ...mine,
            dueAt: { gte: startOfDay, lt: endOfDay },
            status: { notIn: ["DONE", "CANCELLED"] },
          },
        }),
        prisma.task.findMany({
          where: {
            ...mine,
            dueAt: { lt: startOfDay },
            status: { notIn: ["DONE", "CANCELLED"] },
          },
          orderBy: { dueAt: "asc" },
          take: 5,
          select: { title: true, dueAt: true, priority: true },
        }),
        prisma.task.count({
          where: {
            ...mine,
            dueAt: { lt: startOfDay },
            status: { notIn: ["DONE", "CANCELLED"] },
          },
        }),
        prisma.calendarEvent.findMany({
          where: {
            organizationId: orgId,
            deletedAt: null,
            startAt: { gte: now, lt: endOfDay },
            calendar: { ownerId: userId },
          },
          orderBy: { startAt: "asc" },
          take: 5,
        }),
      ]);

    if (dueCount === 0 && overdueCount === 0 && events.length === 0) {
      return {
        title: "Nothing scheduled today",
        body: `Morning ${firstName}. Clear calendar, nothing due. Good day to get ahead.`,
      };
    }

    const lines = [
      `Morning ${firstName}. ${
        dueCount === 0
          ? "Nothing due today."
          : `${dueCount} ${dueCount === 1 ? "task" : "tasks"} due today.`
      }`,
      "",
    ];

    if (dueToday.length > 0) {
      lines.push(`*Due today (${dueCount})*`);
      dueToday.forEach((t) => lines.push(taskLine(t, timeFmt)));
      if (dueCount > dueToday.length) {
        lines.push(`• …and ${dueCount - dueToday.length} more`);
      }
      lines.push("");
    }

    if (overdue.length > 0) {
      lines.push(`*Overdue (${overdueCount})*`);
      overdue.forEach((t) => {
        const late = t.dueAt
          ? daysBetweenKeys(istDayKey(t.dueAt), todayKey)
          : 0;
        const age =
          late <= 0 ? "just missed" : `${late} ${late === 1 ? "day" : "days"} late`;
        lines.push(`• ${age} · ${t.title}${PRIORITY_TAG[t.priority] ?? ""}`);
      });
      if (overdueCount > overdue.length) {
        lines.push(`• …and ${overdueCount - overdue.length} more`);
      }
      lines.push("");
    }

    if (events.length > 0) {
      lines.push("*Calendar*");
      events.forEach((e) =>
        lines.push(`• ${timeFmt.format(e.startAt)} · ${e.title}`)
      );
    }

    return {
      title:
        dueCount > 0
          ? `${dueCount} due today`
          : `${overdueCount} overdue, nothing due today`,
      body: lines.join("\n").trim(),
    };
  }

  if (kind === "EVENING_REVIEW") {
    const [completed, stillOpen, tomorrowCount, tomorrowTasks] =
      await Promise.all([
        prisma.task.count({
          where: { ...mine, status: "DONE", completedAt: { gte: startOfDay } },
        }),
        prisma.task.count({
          where: {
            ...mine,
            dueAt: { gte: startOfDay, lt: endOfDay },
            status: { notIn: ["DONE", "CANCELLED"] },
          },
        }),
        prisma.task.count({
          where: {
            ...mine,
            dueAt: { gte: endOfDay, lt: endOfTomorrow },
            status: { notIn: ["DONE", "CANCELLED"] },
          },
        }),
        prisma.task.findMany({
          where: {
            ...mine,
            dueAt: { gte: endOfDay, lt: endOfTomorrow },
            status: { notIn: ["DONE", "CANCELLED"] },
          },
          orderBy: { dueAt: "asc" },
          take: 5,
          select: { title: true, dueAt: true, priority: true },
        }),
      ]);

    const lines = [`Evening ${firstName}.`, "", `Closed today: ${completed}`];

    if (stillOpen > 0) lines.push(`Still open from today: ${stillOpen}`);

    if (tomorrowCount > 0) {
      lines.push("", `*Tomorrow (${tomorrowCount})*`);
      tomorrowTasks.forEach((t) => lines.push(taskLine(t, timeFmt)));
      if (tomorrowCount > tomorrowTasks.length) {
        lines.push(`• …and ${tomorrowCount - tomorrowTasks.length} more`);
      }
    } else {
      lines.push("", "Nothing due tomorrow.");
    }

    return { title: `${completed} completed today`, body: lines.join("\n") };
  }

  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const [completed, created, overdue] = await Promise.all([
    prisma.task.count({
      where: { ...mine, status: "DONE", completedAt: { gte: weekAgo } },
    }),
    prisma.task.count({ where: { ...mine, createdAt: { gte: weekAgo } } }),
    prisma.task.count({
      where: {
        ...mine,
        dueAt: { lt: now },
        status: { notIn: ["DONE", "CANCELLED"] },
      },
    }),
  ]);

  const rate = created > 0 ? Math.round((completed / created) * 100) : 0;
  const trend = await getScoreTrend(userId, 14);

  const lines = [
    `Week in review, ${firstName}.`,
    "",
    `Completed: ${completed}`,
    `Created: ${created}`,
    `Completion rate: ${rate}%`,
  ];

  if (trend.average !== null) {
    const direction =
      trend.change === null || trend.change === 0
        ? "flat against last week"
        : trend.change > 0
          ? `up ${trend.change} on last week`
          : `down ${Math.abs(trend.change)} on last week`;

    lines.push(`Productivity score: ${trend.average}/100 — ${direction}`);
  }

  lines.push(
    overdue > 0
      ? `Carrying ${overdue} overdue into next week.`
      : "Nothing overdue."
  );

  return {
    title: `Week in review: ${completed} done`,
    body: lines.join("\n"),
  };
}

export async function processDueReminders(limit = 50) {
  const now = new Date();

  const due = await prisma.reminderSchedule.findMany({
    where: { isActive: true, nextSendAt: { lte: now } },
    include: { user: { include: { profile: true } } },
    take: limit,
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const schedule of due) {
    const profile = schedule.user.profile;
    if (!profile) {
      skipped += 1;
      continue;
    }

    // One bad schedule used to take the whole batch down with it, and because
    // nextSendAt is only advanced at the end of the loop body, the same row
    // would fail again on every run — everyone's reminders stop until someone
    // notices. Isolate each one and let the rest through.
    try {
      if (await sendOne(schedule, profile, now)) sent += 1;
    } catch (err) {
      console.error("[reminders] schedule", schedule.id, err);
      failed += 1;
    }

    const next = computeNextSendAt(
      schedule.timeOfDay,
      schedule.timezone,
      schedule.daysOfWeek,
      now
    );

    await prisma.reminderSchedule.update({
      where: { id: schedule.id },
      data: { lastSentAt: now, nextSendAt: next },
    });
  }

  return { processed: due.length, sent, skipped, failed };
}

/** Only the fields the send path actually reads. */
type DueSchedule = {
  id: string;
  type: string;
  channel: string;
  organizationId: string;
  userId: string;
  user: { email: string | null };
};

type DueProfile = {
  timezone: string;
  displayName: string | null;
  whatsappVerified: boolean;
  whatsappOptIn: boolean;
  whatsappNumber: string | null;
};

async function sendOne(
  schedule: DueSchedule,
  profile: DueProfile,
  now: Date
): Promise<boolean> {
  const digest = await buildDigest(
    schedule.type as DigestKind,
    schedule.organizationId,
    schedule.userId,
    profile.timezone,
    profile.displayName ?? "there"
  );

  if (!digest) return false;

  {
      const notification = await prisma.notification.create({
        data: {
          organizationId: schedule.organizationId,
          userId: schedule.userId,
          type: "DIGEST",
          title: digest.title,
          body: digest.body,
        },
      });

      await prisma.notificationDelivery.create({
        data: {
          organizationId: schedule.organizationId,
          notificationId: notification.id,
          channel: "IN_APP",
          status: "DELIVERED",
          deliveredAt: now,
        },
      });

      // ---- Slack ----
      if (schedule.channel === "SLACK") {
        const email = schedule.user.email;

        if (!email) {
          await prisma.notificationDelivery.create({
            data: {
              organizationId: schedule.organizationId,
              notificationId: notification.id,
              channel: "SLACK",
              status: "FAILED",
              error: "No email on account",
            },
          });
        } else {
          const result = await sendSlackToEmail(email, digest.body);

          await prisma.notificationDelivery.create({
            data: {
              organizationId: schedule.organizationId,
              notificationId: notification.id,
              channel: "SLACK",
              status: result.ok ? "SENT" : "FAILED",
              providerMessageId: result.ok ? result.providerMessageId : null,
              sentAt: result.ok ? now : null,
              error: result.ok ? null : result.error,
            },
          });
        }
      }

      // ---- WhatsApp ----
      const wantsWhatsApp =
        schedule.channel === "WHATSAPP" &&
        profile.whatsappVerified &&
        profile.whatsappOptIn &&
        profile.whatsappNumber;

      if (wantsWhatsApp && profile.whatsappNumber) {
        const open = await isServiceWindowOpen(profile.whatsappNumber);

        if (open) {
          const provider = getWhatsAppProvider();
          const result = await provider.sendText({
            to: profile.whatsappNumber,
            body: digest.body,
          });

          await prisma.notificationDelivery.create({
            data: {
              organizationId: schedule.organizationId,
              notificationId: notification.id,
              channel: "WHATSAPP",
              status: result.ok ? "SENT" : "FAILED",
              providerMessageId: result.ok ? result.providerMessageId : null,
              sentAt: result.ok ? now : null,
              error: result.ok ? null : result.error,
            },
          });
        } else {
          await prisma.notificationDelivery.create({
            data: {
              organizationId: schedule.organizationId,
              notificationId: notification.id,
              channel: "WHATSAPP",
              status: "CANCELLED",
              error: "Outside 24h service window — template required",
            },
          });
        }
      }

  }

  return true;
}

export async function backfillNextSendAt() {
  const schedules = await prisma.reminderSchedule.findMany({
    where: { isActive: true, nextSendAt: null },
  });

  for (const s of schedules) {
    const next = computeNextSendAt(s.timeOfDay, s.timezone, s.daysOfWeek);
    await prisma.reminderSchedule.update({
      where: { id: s.id },
      data: { nextSendAt: next },
    });
  }

  return schedules.length;
}