"use client";

import { useState, useTransition } from "react";
import { Globe, Clock } from "lucide-react";
import { updateTimezone, updateWorkingHours } from "@/server/actions/profile";
import {
  TIMEZONES,
  TIMEZONE_REGIONS,
  offsetLabel,
  currentTime,
} from "@/lib/timezones";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const field =
  "rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-violet";

export function ProfileSettings({
  timezone,
  workingHoursStart,
  workingHoursEnd,
  workingDays,
}: {
  timezone: string;
  workingHoursStart: number;
  workingHoursEnd: number;
  workingDays: number[];
}) {
  const [tz, setTz] = useState(timezone);
  const [start, setStart] = useState(workingHoursStart);
  const [end, setEnd] = useState(workingHoursEnd);
  const [days, setDays] = useState<number[]>(workingDays);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveTz(value: string) {
    setTz(value);
    setNote(null);
    startTransition(async () => {
      const result = await updateTimezone(value);
      setNote(result.ok ? "Saved" : result.error);
    });
  }

  function saveHours(next: Partial<{ start: number; end: number; days: number[] }>) {
    const payload = {
      workingHoursStart: next.start ?? start,
      workingHoursEnd: next.end ?? end,
      workingDays: next.days ?? days,
    };
    setNote(null);
    startTransition(async () => {
      const result = await updateWorkingHours(payload);
      setNote(result.ok ? "Saved" : result.error);
    });
  }

  return (
    <div className={`glass rounded-xl px-5 py-5 ${pending ? "opacity-70" : ""}`}>
      <h2 className="text-sm">Your schedule</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Drives reminder timing, calendar display, and workload calculations.
      </p>

      <div className="mt-5 flex flex-col gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Globe size={12} />
          Timezone
        </label>
        <select
          value={tz}
          onChange={(e) => saveTz(e.target.value)}
          className={`${field} w-full`}
        >
          {TIMEZONE_REGIONS.map((region) => {
            const options = TIMEZONES.filter((t) => t.region === region);
            if (options.length === 0) return null;
            return (
              <optgroup key={region} label={region}>
                {options.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label} · {offsetLabel(t.value)}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        <p className="text-xs text-muted-foreground/60">
          It&apos;s currently {currentTime(tz)} there.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock size={12} />
          Working hours
        </label>
        <div className="flex items-center gap-2">
          <select
            value={start}
            onChange={(e) => {
              const v = Number(e.target.value);
              setStart(v);
              saveHours({ start: v });
            }}
            className={field}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {String(i).padStart(2, "0")}:00
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">to</span>
          <select
            value={end}
            onChange={(e) => {
              const v = Number(e.target.value);
              setEnd(v);
              saveHours({ end: v });
            }}
            className={field}
          >
            {Array.from({ length: 24 }, (_, i) => i + 1).map((i) => (
              <option key={i} value={i}>
                {String(i).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <span className="text-xs text-muted-foreground">Working days</span>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => {
            const on = days.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => {
                  const next = on
                    ? days.filter((x) => x !== d.value)
                    : [...days, d.value];
                  if (next.length === 0) return;
                  setDays(next);
                  saveHours({ days: next });
                }}
                className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  on
                    ? "bg-brand-violet/15 text-brand-violet"
                    : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {note && (
        <p className="mt-4 text-xs text-muted-foreground/70">{note}</p>
      )}
    </div>
  );
}