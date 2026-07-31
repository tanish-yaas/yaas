"use client";

import { useState, useTransition } from "react";
import { Clock, Globe } from "lucide-react";
import { updateWorkingHours } from "@/server/actions/profile";
import { APP_CONFIG } from "@/config/app";

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
  workingHoursStart,
  workingHoursEnd,
  workingDays,
}: {
  workingHoursStart: number;
  workingHoursEnd: number;
  workingDays: number[];
}) {
  const [start, setStart] = useState(workingHoursStart);
  const [end, setEnd] = useState(workingHoursEnd);
  const [days, setDays] = useState<number[]>(workingDays);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const localTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_CONFIG.timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  function save(next: Partial<{ start: number; end: number; days: number[] }>) {
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
        Drives reminder timing and workload calculations.
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2.5">
        <Globe size={13} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          India Standard Time · currently {localTime}
        </span>
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
              save({ start: v });
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
              save({ end: v });
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
                  save({ days: next });
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

      {note && <p className="mt-4 text-xs text-muted-foreground/70">{note}</p>}
    </div>
  );
}