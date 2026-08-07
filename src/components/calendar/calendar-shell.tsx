"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Layers,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  createCalendarEvent,
  deleteEvent,
  moveEvent,
  resizeEvent,
  updateCalendarEvent,
} from "@/server/actions/events";
import {
  addDaysToKey,
  addMonthsToKey,
  formatIST,
  fromLocalInput,
  istKeyToDate,
  istMonthStartKey,
  istTodayKey,
  istWeekStartKey,
  localInputFromKey,
} from "@/lib/dates";
import { MonthView } from "./month-view";
import { TimeGrid } from "./time-grid";
import { AgendaView } from "./agenda-view";
import { DayPanel } from "./day-panel";
import { CalendarPanel } from "./calendar-panel";
import { EventPopover } from "./event-popover";
import type { EventPatch } from "@/lib/validators/event";
import { EventForm, type EventFormValues } from "./event-form";
import { eventsOnDay } from "./layout";
import {
  CALENDAR_VIEWS,
  type CalendarOption,
  type CalendarView,
  type DraftSlot,
  type EventItem,
  type TaskItem,
} from "./types";

const HIDDEN_KEY = "yaas.calendar.hidden";

const VIEW_LABEL: Record<CalendarView, string> = {
  month: "Month",
  week: "Week",
  day: "Day",
  agenda: "Agenda",
};

export function CalendarShell({
  view,
  anchorKey,
  events: serverEvents,
  tasks,
  calendars,
  openTasks,
  allLabels,
  members,
  workingHoursStart,
  workingHoursEnd,
  canCreate,
  canShare,
}: {
  view: CalendarView;
  anchorKey: string;
  events: EventItem[];
  tasks: TaskItem[];
  calendars: CalendarOption[];
  openTasks: { id: string; title: string }[];
  allLabels: { id: string; name: string; color: string }[];
  members: { userId: string; name: string }[];
  workingHoursStart: number;
  workingHoursEnd: number;
  canCreate: boolean;
  canShare: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();

  const [mounted, setMounted] = useState(false);
  const [events, setEvents] = useState(serverEvents);
  const [todayKey, setTodayKey] = useState(istTodayKey);
  const [focus, setFocus] = useState(false);
  const [allHours, setAllHours] = useState(false);
  const [panelKey, setPanelKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftSlot | null>(null);
  const [popover, setPopover] = useState<{ id: string; rect: DOMRect } | null>(
    null
  );
  const [calendarPanel, setCalendarPanel] = useState<DOMRect | null>(null);
  const [hiddenCalendars, setHiddenCalendars] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => setMounted(true), []);
  useEffect(() => setEvents(serverEvents), [serverEvents]);

  // Visibility is a per-viewer preference, so it lives in the browser rather
  // than on the shared Calendar row.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(HIDDEN_KEY);
      if (stored) setHiddenCalendars(new Set(JSON.parse(stored) as string[]));
    } catch {
      // A corrupt or unavailable store just means everything stays visible.
    }
  }, []);

  function toggleCalendar(calendarId: string) {
    setHiddenCalendars((prev) => {
      const next = new Set(prev);
      if (next.has(calendarId)) next.delete(calendarId);
      else next.add(calendarId);

      try {
        window.localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
      } catch {
        // Non-fatal — the toggle still applies for this session.
      }
      return next;
    });
  }

  useEffect(() => {
    const id = setInterval(() => setTodayKey(istTodayKey()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !panelKey && !draft && !popover) setFocus(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, panelKey, draft, popover]);

  const navigate = useCallback(
    (nextView: CalendarView, nextKey: string) => {
      router.push(`/calendar?view=${nextView}&date=${nextKey}`, {
        scroll: false,
      });
    },
    [router]
  );

  const step = useCallback(
    (delta: number) => {
      if (view === "month") {
        navigate(view, addMonthsToKey(istMonthStartKey(anchorKey), delta));
      } else if (view === "week") {
        navigate(view, addDaysToKey(anchorKey, 7 * delta));
      } else if (view === "day") {
        navigate(view, addDaysToKey(anchorKey, delta));
      } else {
        navigate(view, addDaysToKey(anchorKey, 30 * delta));
      }
    },
    [anchorKey, navigate, view]
  );

  const startHour = allHours ? 0 : Math.max(0, Math.min(22, workingHoursStart));
  const endHour = allHours
    ? 24
    : Math.min(24, Math.max(startHour + 1, workingHoursEnd));

  const dayKeys = useMemo(() => {
    if (view === "day") return [anchorKey];
    const weekStart = istWeekStartKey(anchorKey);
    return Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
  }, [anchorKey, view]);

  const heading = useMemo(() => {
    const anchorDate = istKeyToDate(anchorKey, 12);

    if (view === "month") {
      return formatIST(anchorDate, { month: "long", year: "numeric" }) ?? "";
    }
    if (view === "week") {
      const start = istKeyToDate(dayKeys[0], 12);
      const end = istKeyToDate(dayKeys[6], 12);
      return `${formatIST(start, { day: "numeric", month: "short" })} – ${formatIST(
        end,
        { day: "numeric", month: "short", year: "numeric" }
      )}`;
    }
    if (view === "day") {
      return (
        formatIST(anchorDate, {
          weekday: "long",
          day: "numeric",
          month: "long",
        }) ?? ""
      );
    }
    return `Next 30 days from ${formatIST(anchorDate, {
      day: "numeric",
      month: "short",
    })}`;
  }, [anchorKey, dayKeys, view]);

  const visibleEvents = useMemo(
    () =>
      hiddenCalendars.size === 0
        ? events
        : events.filter((e) => !hiddenCalendars.has(e.calendarId)),
    [events, hiddenCalendars]
  );

  const popoverEvent = popover
    ? events.find((e) => e.id === popover.id) ?? null
    : null;

  useEffect(() => {
    if (popover && !popoverEvent) setPopover(null);
  }, [popover, popoverEvent]);

  const defaultCalendarId =
    calendars.find((c) => c.canEdit && c.isOwn)?.id ??
    calendars.find((c) => c.canEdit)?.id ??
    "";

  // ---- mutations ---------------------------------------------------------

  async function handleMove(eventId: string, startLocal: string) {
    const start = fromLocalInput(startLocal);
    if (!start) return;

    const before = events;
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        const duration =
          new Date(e.endAt).getTime() - new Date(e.startAt).getTime();
        return {
          ...e,
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() + duration).toISOString(),
        };
      })
    );

    const result = await moveEvent(eventId, startLocal);
    if (result?.error) {
      setEvents(before);
      push(result.error, "error");
      return;
    }
    router.refresh();
  }

  async function handleResize(eventId: string, endLocal: string) {
    const end = fromLocalInput(endLocal);
    if (!end) return;

    const before = events;
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId ? { ...e, endAt: end.toISOString() } : e
      )
    );

    const result = await resizeEvent(eventId, endLocal);
    if (result?.error) {
      setEvents(before);
      push(result.error, "error");
      return;
    }
    router.refresh();
  }

  async function handleCreate(values: EventFormValues): Promise<string | null> {
    const result = await createCalendarEvent({
      title: values.title,
      description: values.description,
      location: values.location,
      startAt: values.startAt,
      endAt: values.endAt,
      allDay: values.allDay,
      taskId: values.taskId || undefined,
      calendarId: values.calendarId || undefined,
    });

    if (!result.ok) return result.error;
    push("Event created");
    router.refresh();
    return null;
  }

  async function handleUpdate(
    eventId: string,
    values: EventFormValues
  ): Promise<string | null> {
    const result = await updateCalendarEvent(eventId, {
      title: values.title,
      description: values.description,
      location: values.location,
      startAt: values.startAt,
      endAt: values.endAt,
      allDay: values.allDay,
      taskId: values.taskId || null,
    });

    if (!result.ok) return result.error;
    push("Event updated");
    router.refresh();
    return null;
  }

  async function handlePatch(
    eventId: string,
    patch: EventPatch
  ): Promise<string | null> {
    const result = await updateCalendarEvent(eventId, patch);
    if (!result.ok) return result.error;
    router.refresh();
    return null;
  }

  async function handleDelete(eventId: string): Promise<string | null> {
    const before = events;
    setEvents((prev) => prev.filter((e) => e.id !== eventId));

    const result = await deleteEvent(eventId);
    if (result?.error) {
      setEvents(before);
      return result.error;
    }

    push("Event deleted");
    router.refresh();
    return null;
  }

  // ---- rendering ---------------------------------------------------------

  function selectEvent(event: EventItem, rect: DOMRect) {
    setPopover({ id: event.id, rect });
  }

  const body = (
    <div
      tabIndex={0}
      onKeyDown={(e) => {
        const target = e.target as HTMLElement;
        if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          step(-1);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          step(1);
        } else if (e.key === "t" || e.key === "T") {
          navigate(view, istTodayKey());
        }
      }}
      className="panel flex min-h-0 flex-1 flex-col overflow-hidden outline-none"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-[26px] font-semibold tracking-tight">
            {heading}
          </h1>
          <p className="mt-0.5 text-[12px] text-faint">
            {visibleEvents.length} {visibleEvents.length === 1 ? "event" : "events"} ·{" "}
            {tasks.length} {tasks.length === 1 ? "deadline" : "deadlines"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous"
              className="icon-btn"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => navigate(view, istTodayKey())}
              className="pill"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next"
              className="icon-btn"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="flex items-center gap-0.5 rounded-full border border-[color-mix(in_oklab,white_11%,transparent)] p-0.5">
            {CALENDAR_VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                data-on={v === view}
                onClick={() => navigate(v, anchorKey)}
                className={
                  v === view
                    ? "pill pill-sm"
                    : "inline-flex h-7 items-center rounded-full px-2.5 text-[12px] text-faint transition-colors hover:text-foreground"
                }
              >
                {VIEW_LABEL[v]}
              </button>
            ))}
          </div>

          {(view === "week" || view === "day") && (
            <button
              type="button"
              data-on={allHours}
              onClick={() => setAllHours((prev) => !prev)}
              title={allHours ? "Show working hours" : "Show all 24 hours"}
              className="pill"
            >
              <Clock3 size={14} />
              {allHours ? "24h" : `${startHour}–${endHour}`}
            </button>
          )}

          {calendars.length > 0 && (
            <button
              type="button"
              data-on={hiddenCalendars.size > 0}
              onClick={(e) =>
                setCalendarPanel((current) =>
                  current ? null : e.currentTarget.getBoundingClientRect()
                )
              }
              title="Calendars"
              className="pill"
            >
              <Layers size={14} />
              {hiddenCalendars.size > 0
                ? `${calendars.length - hiddenCalendars.size}/${calendars.length}`
                : "Calendars"}
            </button>
          )}

          <button
            type="button"
            onClick={() => setFocus((prev) => !prev)}
            title={focus ? "Exit full screen (Esc)" : "Expand to full screen"}
            className="icon-btn"
          >
            {focus ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={() =>
                setDraft({
                  dayKey: todayKey,
                  startMinutes: 9 * 60,
                  endMinutes: 10 * 60,
                })
              }
              className="inline-flex h-[34px] items-center gap-2 rounded-full bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <CalendarPlus size={14} />
              New event
            </button>
          )}
        </div>
      </header>

      {view === "month" && (
        <MonthView
          anchorKey={anchorKey}
          events={visibleEvents}
          tasks={tasks}
          todayKey={todayKey}
          onOpenDay={setPanelKey}
          onSelectEvent={selectEvent}
        />
      )}

      {(view === "week" || view === "day") && (
        <TimeGrid
          dayKeys={dayKeys}
          events={visibleEvents}
          tasks={tasks}
          todayKey={todayKey}
          startHour={startHour}
          endHour={endHour}
          detailed={view === "day"}
          onSelectEvent={selectEvent}
          onCreateSlot={canCreate ? setDraft : () => {}}
          onMoveEvent={handleMove}
          onResizeEvent={handleResize}
          onOpenDay={setPanelKey}
        />
      )}

      {view === "agenda" && (
        <AgendaView
          startKey={anchorKey}
          days={30}
          events={visibleEvents}
          tasks={tasks}
          todayKey={todayKey}
          onSelectEvent={selectEvent}
          onOpenDay={setPanelKey}
        />
      )}
    </div>
  );

  const overlays = (
    <>
      {calendarPanel && (
        <CalendarPanel
          anchor={calendarPanel}
          calendars={calendars}
          hidden={hiddenCalendars}
          members={members}
          canShare={canShare}
          onToggle={toggleCalendar}
          onClose={() => setCalendarPanel(null)}
        />
      )}

      <DayPanel
        dayKey={panelKey}
        events={panelKey ? eventsOnDay(visibleEvents, panelKey) : []}
        tasks={panelKey ? tasks.filter((t) => t.dayKey === panelKey) : []}
        calendars={calendars}
        openTasks={openTasks}
        allLabels={allLabels}
        canCreate={canCreate}
        onClose={() => setPanelKey(null)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {popover && popoverEvent && (
        <EventPopover
          event={popoverEvent}
          anchor={popover.rect}
          openTasks={openTasks}
          onClose={() => setPopover(null)}
          onPatch={handlePatch}
          onDelete={handleDelete}
        />
      )}

      {mounted &&
        createPortal(
          <AnimatePresence>
            {draft && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setDraft(null)}
                className="fixed inset-0 z-[93] flex items-start justify-center bg-black/50 px-4 pt-[12vh]"
              >
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="overlay w-full max-w-md px-4 py-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.12em] text-faint">
                      New event
                    </p>
                    <button
                      type="button"
                      onClick={() => setDraft(null)}
                      className="rounded p-1 text-faint transition-colors hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <DraftForm
                    draft={draft}
                    calendars={calendars}
                    openTasks={openTasks}
                    defaultCalendarId={defaultCalendarId}
                    onCreate={handleCreate}
                    onClose={() => setDraft(null)}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );

  if (focus && mounted) {
    return createPortal(
      <div className="fixed inset-0 z-[80] flex flex-col bg-background px-4 py-4 md:px-6">
        {body}
        {overlays}
      </div>,
      document.body
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
      {body}
      {overlays}
    </div>
  );
}

function DraftForm({
  draft,
  calendars,
  openTasks,
  defaultCalendarId,
  onCreate,
  onClose,
}: {
  draft: DraftSlot;
  calendars: CalendarOption[];
  openTasks: { id: string; title: string }[];
  defaultCalendarId: string;
  onCreate: (values: EventFormValues) => Promise<string | null>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <EventForm
      key={`${draft.dayKey}-${draft.startMinutes}`}
      initial={{
        title: "",
        description: "",
        location: "",
        startAt: localInputFromKey(draft.dayKey, draft.startMinutes),
        endAt: localInputFromKey(draft.dayKey, draft.endMinutes),
        allDay: false,
        taskId: "",
        calendarId: defaultCalendarId,
      }}
      calendars={calendars}
      tasks={openTasks}
      submitLabel="Create event"
      pending={pending}
      error={error}
      onSubmit={async (values) => {
        setPending(true);
        setError(null);
        const message = await onCreate(values);
        setPending(false);
        if (message) setError(message);
        else onClose();
      }}
      onCancel={onClose}
    />
  );
}
