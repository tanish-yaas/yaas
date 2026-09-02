"use client";

import {
  addDaysToKey,
  addMonthsToKey,
  istKeyToDate,
  istMonthStartKey,
  istWeekStartKey,
} from "@/lib/dates";
import { EventChip, TaskChip } from "./event-chip";
import { dayKeysForEvent, dayKeysForTask } from "./layout";
import type { EventItem, TaskItem } from "./types";
import type { AnchorRect } from "@/lib/ui-scale";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 3;

/** `continues*` mark a slice as the middle or end of a bar, not its own thing. */
type Span = { continuesBefore: boolean; continuesAfter: boolean };
type Cell =
  | ({ kind: "event"; sortAt: number; event: EventItem } & Span)
  | ({ kind: "task"; sortAt: number; task: TaskItem } & Span);

export function MonthView({
  anchorKey,
  events,
  tasks,
  todayKey,
  onOpenDay,
  onSelectEvent,
}: {
  anchorKey: string;
  events: EventItem[];
  tasks: TaskItem[];
  todayKey: string;
  onOpenDay: (dayKey: string) => void;
  onSelectEvent: (event: EventItem, rect: AnchorRect) => void;
}) {
  const monthStart = istMonthStartKey(anchorKey);
  const monthEnd = addMonthsToKey(monthStart, 1);
  const gridStart = istWeekStartKey(monthStart);

  const byDay = new Map<string, Cell[]>();
  const push = (key: string, cell: Cell) => {
    const list = byDay.get(key);
    if (list) list.push(cell);
    else byDay.set(key, [cell]);
  };

  for (const event of events) {
    const keys = dayKeysForEvent(event);
    keys.forEach((key, i) =>
      push(key, {
        kind: "event",
        sortAt: event.allDay ? -1 : new Date(event.startAt).getTime(),
        event,
        continuesBefore: i > 0,
        continuesAfter: i < keys.length - 1,
      })
    );
  }

  // A task with a start date is a stretch of work, so it draws across every day
  // from its start to its deadline instead of appearing only on the day it is
  // owed — by then it is too late for the calendar to have been useful.
  for (const task of tasks) {
    const keys = dayKeysForTask(task);
    keys.forEach((key, i) =>
      push(key, {
        kind: "task",
        // Sorted by where the bar starts, so a multi-day task keeps the same
        // row across the days it covers instead of jumping up and down.
        sortAt: new Date(task.startAt ?? task.dueAt).getTime(),
        task,
        continuesBefore: i > 0,
        continuesAfter: i < keys.length - 1,
      })
    );
  }

  for (const list of byDay.values()) list.sort((a, b) => a.sortAt - b.sortAt);

  const days = Array.from({ length: 42 }, (_, i) => addDaysToKey(gridStart, i));

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="grid shrink-0 grid-cols-7 border-b border-[color-mix(in_oklab,white_6%,transparent)]">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-[11px] uppercase tracking-[0.12em] text-faint"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {days.map((key, index) => {
          const items = byDay.get(key) ?? [];
          const inMonth = key >= monthStart && key < monthEnd;
          const isToday = key === todayKey;
          const dayNumber = istKeyToDate(key, 12).getUTCDate();
          const lastColumn = (index + 1) % 7 === 0;
          const lastRow = index >= 35;

          return (
            <div
              key={key}
              role="button"
              tabIndex={-1}
              onClick={() => onOpenDay(key)}
              className={`group flex min-h-24 min-w-0 cursor-pointer flex-col overflow-hidden border-[color-mix(in_oklab,white_6%,transparent)] px-1.5 py-1.5 text-left transition-colors hover:bg-[color-mix(in_oklab,white_4%,transparent)] ${
                lastColumn ? "" : "border-r"
              } ${lastRow ? "" : "border-b"} ${inMonth ? "" : "opacity-35"}`}
            >
              <div className="mb-1 flex shrink-0 items-center justify-between">
                <span className="text-[10px] text-faint opacity-0 transition-opacity group-hover:opacity-100">
                  Open
                </span>
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] tabular-nums ${
                    isToday
                      ? "bg-[var(--primary)] font-medium text-white"
                      : "text-muted-foreground"
                  }`}
                >
                  {dayNumber}
                </span>
              </div>

              <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                {items.slice(0, MAX_CHIPS).map((item, i) =>
                  item.kind === "event" ? (
                    <EventChip
                      key={`e-${item.event.id}-${i}`}
                      event={item.event}
                      onSelect={onSelectEvent}
                      continuesBefore={item.continuesBefore}
                      continuesAfter={item.continuesAfter}
                    />
                  ) : (
                    <TaskChip
                      key={`t-${item.task.id}-${i}`}
                      task={item.task}
                      dayKey={key}
                      onSelect={onOpenDay}
                      continuesBefore={item.continuesBefore}
                      continuesAfter={item.continuesAfter}
                    />
                  )
                )}

                {items.length > MAX_CHIPS && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDay(key);
                    }}
                    className="cursor-pointer px-1.5 text-[10px] text-faint transition-colors hover:text-foreground"
                  >
                    +{items.length - MAX_CHIPS} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
