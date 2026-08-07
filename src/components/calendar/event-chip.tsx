"use client";

import { formatIST } from "@/lib/dates";
import type { EventItem, TaskItem } from "./types";

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "var(--status-red)",
  HIGH: "var(--status-amber)",
  MEDIUM: "var(--status-blue)",
  LOW: "var(--text-faint)",
};

export function EventChip({
  event,
  onSelect,
}: {
  event: EventItem;
  onSelect: (event: EventItem, rect: DOMRect) => void;
}) {
  const time = event.allDay
    ? null
    : formatIST(new Date(event.startAt), { hour: "2-digit", minute: "2-digit" });

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(event, e.currentTarget.getBoundingClientRect());
      }}
      title={
        event.isOwnCalendar
          ? event.title
          : `${event.title} — ${event.ownerName}'s calendar`
      }
      className="flex w-full items-center gap-1 truncate rounded-full border px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition-[filter] hover:brightness-125"
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
}: {
  task: TaskItem;
  onSelect: (dayKey: string) => void;
}) {
  const done = task.row.status === "DONE" || task.row.status === "CANCELLED";
  const color = PRIORITY_COLOR[task.row.priority] ?? PRIORITY_COLOR.LOW;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(task.dayKey);
      }}
      title={task.row.title}
      className={`flex w-full items-center gap-1 truncate rounded-full border px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition-[filter] hover:brightness-125 ${
        done ? "opacity-45 line-through" : ""
      }`}
      style={{
        borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
        color: `color-mix(in oklab, ${color} 88%, white)`,
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{task.row.title}</span>
    </button>
  );
}
