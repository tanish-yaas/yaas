"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarPlus, MapPin, Trash2, X } from "lucide-react";
import {
  formatIST,
  istKeyToDate,
  localInputFromKey,
  toLocalInput,
} from "@/lib/dates";
import { TaskRow } from "@/components/tasks/task-row";
import { EventForm, type EventFormValues } from "./event-form";
import type { CalendarOption, EventItem, TaskItem } from "./types";

/** Bottom sheet on phones, side sheet from the right on desktop. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}

export function DayPanel({
  dayKey,
  events,
  tasks,
  calendars,
  openTasks,
  canCreate,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  dayKey: string | null;
  events: EventItem[];
  tasks: TaskItem[];
  calendars: CalendarOption[];
  openTasks: { id: string; title: string }[];
  canCreate: boolean;
  onClose: () => void;
  onCreate: (values: EventFormValues) => Promise<string | null>;
  onUpdate: (eventId: string, values: EventFormValues) => Promise<string | null>;
  onDelete: (eventId: string) => Promise<string | null>;
}) {
  const isDesktop = useIsDesktop();
  const [mounted, setMounted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setCreating(false);
    setEditingId(null);
    setError(null);
  }, [dayKey]);

  useEffect(() => {
    if (!dayKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dayKey, onClose]);

  if (!mounted) return null;

  const defaultCalendarId =
    calendars.find((c) => c.canEdit && c.isOwn)?.id ??
    calendars.find((c) => c.canEdit)?.id ??
    "";

  const dayEvents = [...events].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
  });

  const dayTasks = [...tasks].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  );

  async function run(fn: () => Promise<string | null>, onDone: () => void) {
    setPending(true);
    setError(null);
    const message = await fn();
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    onDone();
  }

  const panel = (
    <AnimatePresence>
      {dayKey && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-black/50"
          />

          <motion.aside
            initial={isDesktop ? { x: "100%" } : { y: "100%" }}
            animate={isDesktop ? { x: 0 } : { y: 0 }}
            exit={isDesktop ? { x: "100%" } : { y: "100%" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overlay fixed inset-x-0 bottom-0 z-[91] flex max-h-[85vh] flex-col md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[26rem]"
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[color-mix(in_oklab,white_7%,transparent)] px-5 py-4">
              <div>
                <p className="text-[17px] font-semibold tracking-tight">
                  {formatIST(istKeyToDate(dayKey, 12), {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                <p className="mt-0.5 text-[12px] text-faint">
                  {dayEvents.length} {dayEvents.length === 1 ? "event" : "events"}
                  {" · "}
                  {dayTasks.length} due
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-faint transition-colors hover:text-foreground"
              >
                <X size={16} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {canCreate && (
                <div className="mb-4">
                  {creating ? (
                    <div className="rounded-xl border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-[color-mix(in_oklab,var(--primary)_6%,transparent)] px-3 py-3">
                      <EventForm
                        initial={{
                          title: "",
                          description: "",
                          location: "",
                          startAt: localInputFromKey(dayKey, 9 * 60),
                          endAt: localInputFromKey(dayKey, 10 * 60),
                          allDay: false,
                          taskId: "",
                          calendarId: defaultCalendarId,
                        }}
                        calendars={calendars}
                        tasks={openTasks}
                        submitLabel="Create event"
                        pending={pending}
                        error={error}
                        onSubmit={(values) =>
                          run(
                            () => onCreate(values),
                            () => setCreating(false)
                          )
                        }
                        onCancel={() => setCreating(false)}
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setCreating(true);
                      }}
                      className="pill w-full justify-center"
                    >
                      <CalendarPlus size={14} />
                      New event
                    </button>
                  )}
                </div>
              )}

              {dayEvents.length > 0 && (
                <section className="mb-5">
                  <h3 className="mb-2 px-1 text-[11px] uppercase tracking-[0.12em] text-faint">
                    Events
                  </h3>
                  <div className="flex flex-col gap-1.5">
                    {dayEvents.map((event) =>
                      editingId === event.id ? (
                        <div
                          key={event.id}
                          className="rounded-xl border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-[color-mix(in_oklab,var(--primary)_6%,transparent)] px-3 py-3"
                        >
                          <EventForm
                            initial={{
                              title: event.title,
                              description: event.description,
                              location: event.location,
                              startAt: toLocalInput(event.startAt),
                              endAt: toLocalInput(event.endAt),
                              allDay: event.allDay,
                              taskId: event.taskId ?? "",
                              calendarId: event.calendarId,
                            }}
                            calendars={calendars}
                            tasks={openTasks}
                            submitLabel="Save"
                            pending={pending}
                            error={error}
                            onSubmit={(values) =>
                              run(
                                () => onUpdate(event.id, values),
                                () => setEditingId(null)
                              )
                            }
                            onCancel={() => setEditingId(null)}
                          />
                        </div>
                      ) : (
                        <div
                          key={event.id}
                          className="group flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-[color-mix(in_oklab,white_4%,transparent)]"
                        >
                          <span
                            className="mt-1 h-8 w-0.5 shrink-0 rounded-full"
                            style={{ backgroundColor: event.color }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              event.canEdit ? setEditingId(event.id) : undefined
                            }
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-[13px]">{event.title}</p>
                            <p className="truncate text-[11px] tabular-nums text-faint">
                              {event.allDay
                                ? "All day"
                                : `${formatIST(new Date(event.startAt), {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })} – ${formatIST(new Date(event.endAt), {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}`}
                              {!event.isOwnCalendar && ` · ${event.ownerName}`}
                            </p>
                            {event.location && (
                              <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-faint">
                                <MapPin size={10} />
                                {event.location}
                              </p>
                            )}
                            {event.taskTitle && (
                              <p
                                className="mt-0.5 truncate text-[11px]"
                                style={{ color: "var(--primary)" }}
                              >
                                ↳ {event.taskTitle}
                              </p>
                            )}
                          </button>

                          {event.canEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirmingId !== event.id) {
                                  setConfirmingId(event.id);
                                  window.setTimeout(
                                    () =>
                                      setConfirmingId((id) =>
                                        id === event.id ? null : id
                                      ),
                                    3000
                                  );
                                  return;
                                }
                                run(
                                  () => onDelete(event.id),
                                  () => setConfirmingId(null)
                                );
                              }}
                              disabled={pending}
                              className={`shrink-0 rounded px-1.5 py-1 text-[10px] ${
                                confirmingId === event.id
                                  ? "text-[var(--status-red)]"
                                  : "hover-action"
                              }`}
                            >
                              {confirmingId === event.id ? (
                                "Sure?"
                              ) : (
                                <Trash2 size={13} />
                              )}
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </section>
              )}

              {dayTasks.length > 0 && (
                <section>
                  <h3 className="mb-2 px-1 text-[11px] uppercase tracking-[0.12em] text-faint">
                    Due this day
                  </h3>
                  <div className="list">
                    {/* One child, so .list's own separators stay out of the way
                        of the hairlines TaskRow already draws. */}
                    <div className="px-1.5">
                      {dayTasks.map((task) => (
                        <TaskRow key={task.id} task={task.row} />
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {dayEvents.length === 0 && dayTasks.length === 0 && (
                <p className="px-1 py-8 text-center text-[13px] text-muted-foreground">
                  Nothing on this day yet.
                </p>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(panel, document.body);
}
