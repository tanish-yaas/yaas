"use client";

import { formatIST } from "@/lib/dates";
import type { EventItem, TaskItem } from "./types";

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "#FF4D6D",
  HIGH: "#F5B544",
  MEDIUM: "#22D3EE",
  LOW: "#8B8B9E",
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
      className="flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[10px] leading-tight transition-colors hover:brightness-125"
      style={{
        backgroundColor: `color-mix(in oklab, ${event.color} 22%, transparent)`,
        color: "var(--foreground)",
      }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: event.color }}
      />
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

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(task.dayKey);
      }}
      title={task.row.title}
      className={`flex w-full items-center gap-1 truncate rounded border border-dashed px-1.5 py-0.5 text-left text-[10px] leading-tight transition-colors hover:bg-secondary/60 ${
        done ? "opacity-45 line-through" : ""
      }`}
      style={{ borderColor: "color-mix(in oklab, var(--border) 100%, transparent)" }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-[2px]"
        style={{
          backgroundColor: PRIORITY_DOT[task.row.priority] ?? PRIORITY_DOT.LOW,
        }}
      />
      <span className="truncate text-muted-foreground">{task.row.title}</span>
    </button>
  );
}
