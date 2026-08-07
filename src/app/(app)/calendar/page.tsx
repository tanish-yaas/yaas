import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import { getCalendarsForUser } from "@/server/services/calendar";
import { buildTaskScope } from "@/server/services/tasks";
import { CalendarShell } from "@/components/calendar/calendar-shell";
import {
  CALENDAR_VIEWS,
  type CalendarView,
  type EventItem,
  type TaskItem,
} from "@/components/calendar/types";
import {
  addDaysToKey,
  formatIST,
  isDayKey,
  istDayKey,
  istKeyToDate,
  istMonthStartKey,
  istTodayKey,
  istWeekStartKey,
  toLocalInput,
} from "@/lib/dates";

/** How many days of data each view needs, anchored on a day key. */
function resolveRange(view: CalendarView, anchorKey: string) {
  if (view === "month") {
    return { startKey: istWeekStartKey(istMonthStartKey(anchorKey)), days: 42 };
  }
  if (view === "week") return { startKey: istWeekStartKey(anchorKey), days: 7 };
  if (view === "day") return { startKey: anchorKey, days: 1 };
  return { startKey: anchorKey, days: 30 };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getCurrentContext();
  if (!ctx?.membership || !ctx.profile) return null;

  const orgId = ctx.membership.organizationId;
  const userId = ctx.session.user.id;

  const view: CalendarView = CALENDAR_VIEWS.includes(
    params.view as CalendarView
  )
    ? (params.view as CalendarView)
    : "month";

  const anchorKey = isDayKey(params.date) ? params.date : istTodayKey();

  const { startKey, days } = resolveRange(view, anchorKey);
  const rangeStart = istKeyToDate(startKey);
  const rangeEnd = istKeyToDate(addDaysToKey(startKey, days));

  const [calendars, taskScope] = await Promise.all([
    getCalendarsForUser(orgId, userId, ctx.permissions),
    buildTaskScope(orgId, userId, ctx.permissions),
  ]);

  const calendarIds = calendars.map((c) => c.id);

  const [events, dueTasks, openTasks] = await Promise.all([
    calendarIds.length > 0
      ? prisma.calendarEvent.findMany({
          where: {
            organizationId: orgId,
            calendarId: { in: calendarIds },
            deletedAt: null,
            // Anything overlapping the window, not just starting inside it.
            startAt: { lt: rangeEnd },
            endAt: { gt: rangeStart },
          },
          orderBy: { startAt: "asc" },
          include: {
            task: { select: { id: true, title: true } },
            attendees: {
              include: { user: { select: { name: true, email: true } } },
            },
          },
        })
      : Promise.resolve([]),
    prisma.task.findMany({
      where: { ...taskScope, dueAt: { gte: rangeStart, lt: rangeEnd } },
      orderBy: { dueAt: "asc" },
      include: {
        assignments: { include: { user: { select: { name: true } } } },
        labels: {
          include: {
            label: { select: { id: true, name: true, color: true } },
          },
        },
      },
    }),
    prisma.task.findMany({
      where: { ...taskScope, status: { notIn: ["DONE", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, title: true },
    }),
  ]);

  const canShare = ctx.permissions.has("calendar.share");
  const canShareAny = ctx.permissions.has("calendar.edit_any");

  const shareableIds = calendars
    .filter((c) => c.isOwn || canShareAny)
    .map((c) => c.id);

  const [shares, memberRows] = await Promise.all([
    canShare && shareableIds.length > 0
      ? prisma.calendarShare.findMany({
          where: { organizationId: orgId, calendarId: { in: shareableIds } },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    canShare
      ? prisma.organizationMember.findMany({
          where: {
            organizationId: orgId,
            status: "ACTIVE",
            userId: { not: userId },
          },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const sharesByCalendar = new Map<
    string,
    { id: string; userId: string; name: string; accessLevel: string }[]
  >();

  for (const share of shares) {
    const list = sharesByCalendar.get(share.calendarId) ?? [];
    list.push({
      id: share.id,
      userId: share.userId,
      name: share.user.name ?? share.user.email ?? "Member",
      accessLevel: share.accessLevel,
    });
    sharesByCalendar.set(share.calendarId, list);
  }

  const calendarById = new Map(calendars.map((c) => [c.id, c]));
  const canEditOwn = ctx.permissions.has("calendar.edit_own");

  const eventItems: EventItem[] = events.map((e) => {
    const calendar = calendarById.get(e.calendarId);

    return {
      id: e.id,
      title: e.title,
      description: e.description ?? "",
      location: e.location ?? "",
      meetingUrl: e.meetingUrl ?? "",
      startAt: e.startAt.toISOString(),
      endAt: e.endAt.toISOString(),
      allDay: e.allDay,
      calendarId: e.calendarId,
      calendarName: calendar?.name ?? "Calendar",
      color: calendar?.color ?? "#7C5CFF",
      ownerName: calendar?.ownerName ?? "",
      isOwnCalendar: calendar?.isOwn ?? false,
      taskId: e.task?.id ?? null,
      taskTitle: e.task?.title ?? null,
      attendees: e.attendees.map((a) => ({
        id: a.id,
        name: a.user?.name ?? a.name ?? a.email ?? a.user?.email ?? "Guest",
        status: a.status,
      })),
      canEdit:
        (calendar?.canEdit ?? false) || (e.createdById === userId && canEditOwn),
    };
  });

  const now = new Date();

  const taskItems: TaskItem[] = dueTasks
    .filter((t) => t.dueAt !== null)
    .map((t) => ({
      id: t.id,
      dueAt: t.dueAt!.toISOString(),
      dayKey: istDayKey(t.dueAt!),
      row: {
        id: t.id,
        title: t.title,
        description: t.description ?? "",
        status: t.status,
        priority: t.priority,
        dueAtInput: toLocalInput(t.dueAt),
        dueAtLabel: formatIST(t.dueAt),
        estimatedMinutes: t.estimatedMinutes ? String(t.estimatedMinutes) : "",
        overdue: t.dueAt! < now,
        assignees: t.assignments.map((a) => a.user.name ?? "").filter(Boolean),
        labels: t.labels.map((tl) => tl.label),
      },
    }));

  const labelRows = await prisma.label.findMany({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });

  return (
    <CalendarShell
      view={view}
      anchorKey={anchorKey}
      events={eventItems}
      tasks={taskItems}
      calendars={calendars.map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        ownerName: c.ownerName,
        isOwn: c.isOwn,
        canEdit: c.canEdit,
        canShare: canShare && (c.isOwn || canShareAny),
        shares: sharesByCalendar.get(c.id) ?? [],
      }))}
      openTasks={openTasks}
      allLabels={labelRows}
      members={memberRows.map((m) => ({
        userId: m.userId,
        name: m.user.name ?? m.user.email ?? "Member",
      }))}
      workingHoursStart={ctx.profile.workingHoursStart}
      workingHoursEnd={ctx.profile.workingHoursEnd}
      canCreate={canEditOwn || canShareAny}
      canShare={canShare}
    />
  );
}
