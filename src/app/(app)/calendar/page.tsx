import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import { getVisibleCalendarIds } from "@/server/services/calendar";
import { buildTaskScope } from "@/server/services/tasks";
import { EventComposer } from "@/components/calendar/event-composer";
import { EventChip } from "@/components/calendar/event-chip";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type DayItem = {
  id: string;
  label: string;
  time: string | null;
  kind: "event" | "task";
};

function parseMonth(value?: string) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    return new Date(y, m - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const ctx = await getCurrentContext();
  if (!ctx?.membership || !ctx.profile) return null;

  const orgId = ctx.membership.organizationId;
  const userId = ctx.session.user.id;
  const tz = ctx.profile.timezone;

  const monthStart = parseMonth(month);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

  // Grid starts on the Monday on or before the 1st
  const gridStart = new Date(monthStart);
  const shift = (gridStart.getDay() + 6) % 7;
  gridStart.setDate(gridStart.getDate() - shift);

  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridEnd.getDate() + 42);

  const calendarIds = await getVisibleCalendarIds(orgId, userId, ctx.permissions);
  const taskScope = await buildTaskScope(orgId, userId, ctx.permissions);

  const [events, dueTasks, openTasks] = await Promise.all([
    calendarIds.length > 0
      ? prisma.calendarEvent.findMany({
          where: {
            organizationId: orgId,
            calendarId: { in: calendarIds },
            deletedAt: null,
            startAt: { gte: gridStart, lt: gridEnd },
          },
          orderBy: { startAt: "asc" },
          select: { id: true, title: true, startAt: true, allDay: true },
        })
      : Promise.resolve([]),
    prisma.task.findMany({
      where: { ...taskScope, dueAt: { gte: gridStart, lt: gridEnd } },
      orderBy: { dueAt: "asc" },
      select: { id: true, title: true, dueAt: true, status: true },
    }),
    prisma.task.findMany({
      where: { ...taskScope, status: { notIn: ["DONE", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, title: true },
    }),
  ]);

  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: tz,
    }).format(d);

  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });

  const byDay = new Map<string, DayItem[]>();

  for (const e of events) {
    const key = dayKey(e.startAt);
    const list = byDay.get(key) ?? [];
    list.push({
      id: e.id,
      label: e.title,
      time: e.allDay ? null : timeFmt.format(e.startAt),
      kind: "event",
    });
    byDay.set(key, list);
  }

  for (const t of dueTasks) {
    if (!t.dueAt || t.status === "DONE" || t.status === "CANCELLED") continue;
    const key = dayKey(t.dueAt);
    const list = byDay.get(key) ?? [];
    list.push({ id: t.id, label: t.title, time: null, kind: "task" });
    byDay.set(key, list);
  }

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const todayKey = dayKey(new Date());
  const prev = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1);
  const next = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {new Intl.DateTimeFormat("en-GB", {
              month: "long",
              year: "numeric",
            }).format(monthStart)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {events.length} events · {dueTasks.length} deadlines
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${monthKey(prev)}`}
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft size={15} />
          </Link>
          <Link
            href="/calendar"
            className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Today
          </Link>
          <Link
            href={`/calendar?month=${monthKey(next)}`}
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight size={15} />
          </Link>
        </div>
      </header>

      <div className="mb-5">
        <EventComposer tasks={openTasks} />
      </div>

      <div className="glass overflow-hidden rounded-xl">
        <div className="grid grid-cols-7 border-b border-border/60">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-[10px] uppercase tracking-[0.15em] text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = dayKey(day);
            const items = byDay.get(key) ?? [];
            const inMonth = day >= monthStart && day < monthEnd;
            const isToday = key === todayKey;

            return (
              <div
                key={key}
                className={`min-h-24 border-b border-r border-border/40 px-1.5 py-1.5 ${
                  inMonth ? "" : "opacity-35"
                }`}
              >
                <div className="mb-1 flex justify-end">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      isToday
                        ? "bg-brand-violet font-medium text-white"
                        : "text-muted-foreground"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {items.slice(0, 3).map((item) => (
                    <EventChip key={`${item.kind}-${item.id}`} {...item} />
                  ))}
                  {items.length > 3 && (
                    <span className="px-1.5 text-[10px] text-muted-foreground">
                      +{items.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-violet/40" />
          Events
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#22D3EE]/40" />
          Task deadlines
        </span>
      </div>
    </div>
  );
}