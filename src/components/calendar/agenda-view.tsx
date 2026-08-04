"use client";

import { CalendarDays } from "lucide-react";
import { addDaysToKey, formatIST, istDayKey, istKeyToDate } from "@/lib/dates";
import { EmptyState } from "@/components/ui/empty-state";
import type { EventItem, TaskItem } from "./types";

type Row =
  | { kind: "event"; sortAt: number; event: EventItem }
  | { kind: "task"; sortAt: number; task: TaskItem };

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "#FF4D6D",
  HIGH: "#F5B544",
  MEDIUM: "#22D3EE",
  LOW: "#8B8B9E",
};

export function AgendaView({
  startKey,
  days,
  events,
  tasks,
  todayKey,
  onSelectEvent,
  onOpenDay,
}: {
  startKey: string;
  days: number;
  events: EventItem[];
  tasks: TaskItem[];
  todayKey: string;
  onSelectEvent: (event: EventItem, rect: DOMRect) => void;
  onOpenDay: (dayKey: string) => void;
}) {
  const byDay = new Map<string, Row[]>();
  const push = (key: string, row: Row) => {
    const list = byDay.get(key);
    if (list) list.push(row);
    else byDay.set(key, [row]);
  };

  for (const event of events) {
    push(istDayKey(new Date(event.startAt)), {
      kind: "event",
      sortAt: event.allDay ? -1 : new Date(event.startAt).getTime(),
      event,
    });
  }

  for (const task of tasks) {
    push(task.dayKey, {
      kind: "task",
      sortAt: new Date(task.dueAt).getTime(),
      task,
    });
  }

  const dayKeys = Array.from({ length: days }, (_, i) =>
    addDaysToKey(startKey, i)
  ).filter((key) => (byDay.get(key)?.length ?? 0) > 0);

  if (dayKeys.length === 0) {
    return (
      <div className="glass flex min-h-0 flex-1 items-center justify-center rounded-xl py-16">
        <EmptyState
          icon={CalendarDays}
          title="Nothing scheduled"
          description="No events or deadlines in the next 30 days. Click any day in month or week view to add something."
        />
      </div>
    );
  }

  return (
    <div className="glass min-h-0 flex-1 overflow-y-auto rounded-xl px-4 py-4">
      <div className="flex flex-col gap-5">
        {dayKeys.map((key) => {
          const rows = (byDay.get(key) ?? []).sort((a, b) => a.sortAt - b.sortAt);
          const date = istKeyToDate(key, 12);
          const isToday = key === todayKey;

          return (
            <section key={key}>
              <button
                type="button"
                onClick={() => onOpenDay(key)}
                className="mb-2 flex items-baseline gap-2 transition-colors hover:text-foreground"
              >
                <span
                  className={`text-sm font-medium ${
                    isToday ? "text-brand-violet" : ""
                  }`}
                >
                  {isToday ? "Today" : formatIST(date, { weekday: "long" })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatIST(date, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </button>

              <ul className="flex flex-col divide-y divide-border/50 overflow-hidden rounded-lg border border-border/50">
                {rows.map((row, i) =>
                  row.kind === "event" ? (
                    <li key={`e-${row.event.id}-${i}`}>
                      <button
                        type="button"
                        onClick={(e) =>
                          onSelectEvent(
                            row.event,
                            e.currentTarget.getBoundingClientRect()
                          )
                        }
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
                      >
                        <span
                          className="h-8 w-0.5 shrink-0 rounded-full"
                          style={{ backgroundColor: row.event.color }}
                        />
                        <span className="w-24 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {row.event.allDay
                            ? "All day"
                            : `${formatIST(new Date(row.event.startAt), {
                                hour: "2-digit",
                                minute: "2-digit",
                              })} – ${formatIST(new Date(row.event.endAt), {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {row.event.title}
                          </span>
                          {(row.event.location || !row.event.isOwnCalendar) && (
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {[
                                row.event.location,
                                row.event.isOwnCalendar
                                  ? null
                                  : row.event.ownerName,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ) : (
                    <li key={`t-${row.task.id}-${i}`}>
                      <button
                        type="button"
                        onClick={() => onOpenDay(row.task.dayKey)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
                      >
                        <span
                          className="h-8 w-0.5 shrink-0 rounded-full border border-dashed"
                          style={{
                            borderColor:
                              PRIORITY_COLOR[row.task.row.priority] ??
                              PRIORITY_COLOR.LOW,
                          }}
                        />
                        <span className="w-24 shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          Due{" "}
                          {formatIST(new Date(row.task.dueAt), {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block truncate text-sm ${
                              row.task.row.status === "DONE"
                                ? "text-muted-foreground line-through"
                                : ""
                            }`}
                          >
                            {row.task.row.title}
                          </span>
                        </span>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                          style={{
                            color:
                              PRIORITY_COLOR[row.task.row.priority] ??
                              PRIORITY_COLOR.LOW,
                            backgroundColor: `color-mix(in oklab, ${
                              PRIORITY_COLOR[row.task.row.priority] ??
                              PRIORITY_COLOR.LOW
                            } 15%, transparent)`,
                          }}
                        >
                          {row.task.row.priority}
                        </span>
                      </button>
                    </li>
                  )
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
