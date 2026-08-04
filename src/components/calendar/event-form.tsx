"use client";

import { useState } from "react";
import type { CalendarOption } from "./types";

export type EventFormValues = {
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  taskId: string;
  calendarId: string;
};

const field =
  "w-full rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-violet";

export function EventForm({
  initial,
  calendars,
  tasks,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial: EventFormValues;
  calendars: CalendarOption[];
  tasks: { id: string; title: string }[];
  submitLabel: string;
  pending: boolean;
  error: string | null;
  onSubmit: (values: EventFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<EventFormValues>(initial);

  const writable = calendars.filter((c) => c.canEdit);

  function set<K extends keyof EventFormValues>(
    key: K,
    value: EventFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="flex flex-col gap-2.5"
    >
      <input
        value={values.title}
        onChange={(e) => set("title", e.target.value)}
        autoFocus
        required
        placeholder="Event title"
        className={`${field} text-sm`}
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Starts
          </span>
          <input
            type="datetime-local"
            value={values.startAt}
            onChange={(e) => set("startAt", e.target.value)}
            required
            className={field}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Ends
          </span>
          <input
            type="datetime-local"
            value={values.endAt}
            onChange={(e) => set("endAt", e.target.value)}
            required
            className={field}
          />
        </label>
      </div>

      <input
        value={values.location}
        onChange={(e) => set("location", e.target.value)}
        placeholder="Location"
        className={field}
      />

      <textarea
        value={values.description}
        onChange={(e) => set("description", e.target.value)}
        rows={2}
        placeholder="Notes…"
        className={field}
      />

      <div className="grid grid-cols-2 gap-2">
        {writable.length > 1 && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Calendar
            </span>
            <select
              value={values.calendarId}
              onChange={(e) => set("calendarId", e.target.value)}
              className={field}
            >
              {writable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Link to task
          </span>
          <select
            value={values.taskId}
            onChange={(e) => set("taskId", e.target.value)}
            className={field}
          >
            <option value="">None</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={values.allDay}
          onChange={(e) => set("allDay", e.target.checked)}
          className="h-3.5 w-3.5 accent-[#7C5CFF]"
        />
        <span className="text-xs text-muted-foreground">All day</span>
      </label>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
