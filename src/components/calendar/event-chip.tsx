"use client";

import { formatIST } from "@/lib/dates";
import type { EventItem, TaskItem } from "./types";
import { toZoomed, type AnchorRect } from "@/lib/ui-scale";

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "var(--status-red)",
  HIGH: "var(--status-amber)",
  MEDIUM: "var(--status-blue)",
  LOW: "var(--text-faint)",
};

/**
 * Squared-off ends on the days a bar runs through, so a multi-day event reads
 * as one continuous stretch across the week rather than a row of separate
 * pills that happen to share a title.
 */
function spanShape(continuesBefore?: boolean, continuesAfter?: boolean) {
  return `${continuesBefore ? "rounded-l-none border-l-0" : ""} ${
    continuesAfter ? "rounded-r-none border-r-0" : ""
  }`;
}

export function EventChip({
  event,
  onSelect,
  continuesBefore,
  continuesAfter,
}: {
  event: EventItem;
  onSelect: (event: EventItem, rect: AnchorRect) => void;
  /** This chip is a middle or end slice of a multi-day event. */
  continuesBefore?: boolean;
  continuesAfter?: boolean;
}) {
  // The time belongs to the day the event actually starts. Repeating it on
  // every day of a three-day event would claim it starts again each morning.
  const time =
    event.allDay || continuesBefore
      ? null
      : formatIST(new Date(event.startAt), { hour: "2-digit", minute: "2-digit" });

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(
          event,
          toZoomed(e.currentTarget.getBoundingClientRect(), e.currentTarget)
        );
      }}
      title={
        event.isOwnCalendar
          ? event.title
          : `${event.title} — ${event.ownerName}'s calendar`
      }
      className={`flex w-full items-center gap-1 truncate rounded-full border px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition-[filter] hover:brightness-125 ${spanShape(
        continuesBefore,
        continuesAfter
      )}`}
      style={{
        borderColor: `color-mix(in oklab, ${event.color} 45%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${event.color} 18%, transparent)`,
        color: `color-mix(in oklab, ${event.color} 88%, white)`,
      }}
    >
      {time && <span className="shrink-0 opacity-70">{time}</span>}
      <span className="truncate">{event.title}</span>
    </button>
  );
}

export function TaskChip({
  task,
  onSelect,
  dayKey,
  continuesBefore,
  continuesAfter,
}: {
  task: TaskItem;
  onSelect: (dayKey: string) => void;
  /** The day this chip sits on — which is what clicking it should open. */
  dayKey?: string;
  /** This chip is a middle or end slice of a task that spans several days. */
  continuesBefore?: boolean;
  continuesAfter?: boolean;
}) {
  const done = task.row.status === "DONE" || task.row.status === "CANCELLED";

  // A label is the thing the user chose a colour for, so it wins. Priority is
  // the fallback for tasks nobody has labelled yet.
  const color =
    task.row.labels[0]?.color ??
    PRIORITY_COLOR[task.row.priority] ??
    PRIORITY_COLOR.LOW;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(dayKey ?? task.dayKey);
      }}
      title={
        continuesAfter
          ? `${task.row.title} — due ${task.row.dueAtLabel ?? ""}`.trim()
          : task.row.title
      }
      className={`flex w-full items-center gap-1 truncate rounded-full border px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition-[filter] hover:brightness-125 ${
        done ? "opacity-45 line-through" : ""
      } ${spanShape(continuesBefore, continuesAfter)}`}
      style={{
        borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
        color: `color-mix(in oklab, ${color} 88%, white)`,
      }}
    >
      {/* Filled on the deadline itself, hollow on the run-up to it — the bar
          says "this is being worked on", the solid mark says "this is when it
          is owed". */}
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-[2px] border"
        style={{
          borderColor: color,
          backgroundColor: continuesAfter ? "transparent" : color,
        }}
      />
      <span className="truncate">{task.row.title}</span>
    </button>
  );
}
