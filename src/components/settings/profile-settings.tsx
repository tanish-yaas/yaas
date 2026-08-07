"use client";

import { useState, useTransition } from "react";
import { Clock, Globe } from "lucide-react";
import { updateWorkingHours } from "@/server/actions/profile";
import { APP_CONFIG } from "@/config/app";
import { SettingsPanel } from "./settings-panel";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const field = "field";

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
    <SettingsPanel
      title="Your schedule"
      dimmed={pending}
      description="Drives reminder timing and workload calculations."
    >
      <div className="flex items-center gap-2 rounded-xl border border-[color-mix(in_oklab,white_9%,transparent)] px-3 py-2.5">
        <Globe size={13} className="text-faint" />
        <span className="text-[12px] text-muted-foreground">
          India Standard Time · currently {localTime}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-faint">
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
          <span className="shrink-0 text-[12px] text-faint">to</span>
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
        <span className="text-[11px] uppercase tracking-[0.12em] text-faint">
          Working days
        </span>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d) => {
            const on = days.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                data-on={on}
                onClick={() => {
                  const next = on
                    ? days.filter((x) => x !== d.value)
                    : [...days, d.value];
                  if (next.length === 0) return;
                  setDays(next);
                  save({ days: next });
                }}
                className="pill pill-sm"
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {note && <p className="mt-4 text-[12px] text-faint">{note}</p>}
    </SettingsPanel>
  );
}