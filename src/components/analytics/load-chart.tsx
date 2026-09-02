"use client";

import { useState } from "react";
import { SERIES } from "./palette";

export type LoadPoint = {
  dayKey: string;
  /** "02/09" and "02/09/2026", formatted server-side in IST. */
  short: string;
  full: string;
  weekdayLabel: string;
  isToday: boolean;
  isWeekend: boolean;
  count: number;
  hours: number;
};

/**
 * How much work is due on each of the next fourteen days.
 *
 * One series, so one colour — no ramp across the bars. Colouring each bar
 * darker-where-taller would spend the identity channel re-encoding what the
 * bar height already says. Hours ride in the tooltip rather than a second
 * y-axis: two scales on one plot invent a relationship that is not there.
 */
export function LoadChart({ points }: { points: LoadPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...points.map((p) => p.count));
  const peak = points.findIndex((p) => p.count === max && max > 0);
  const active = hover === null ? null : points[hover];

  return (
    <div>
      <div className="relative flex h-36 items-end gap-[2px]">
        {points.map((p, i) => {
          const height = (p.count / max) * 100;
          const hovered = hover === i;

          return (
            <button
              key={p.dayKey}
              type="button"
              tabIndex={-1}
              aria-label={`${p.full}: ${p.count} due, about ${p.hours} hours`}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onBlur={() => setHover(null)}
              // The whole column is the hit target, so a one-task day is as
              // easy to hover as a busy one.
              className="group relative flex h-full flex-1 flex-col justify-end"
            >
              {/* The peak is direct-labelled; every other value is in the
                  tooltip and the row beneath. A number on every bar is noise. */}
              {i === peak && p.count > 0 && !hovered && (
                <span
                  className="absolute inset-x-0 text-center text-[10px] tabular-nums text-muted-foreground"
                  style={{ bottom: `calc(${height}% + 3px)` }}
                >
                  {p.count}
                </span>
              )}

              <span
                className="w-full rounded-t-[4px] transition-[height,opacity] duration-150"
                style={{
                  height: p.count === 0 ? 2 : `${Math.max(height, 3)}%`,
                  backgroundColor:
                    p.count === 0
                      ? "color-mix(in oklab, white 10%, transparent)"
                      : SERIES[0],
                  opacity: hover === null || hovered ? 1 : 0.55,
                }}
              />
            </button>
          );
        })}

        {active && (
          <div
            className="overlay pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap px-2.5 py-1.5 text-[11px]"
            style={{
              left: `${Math.min(88, Math.max(12, ((hover! + 0.5) / points.length) * 100))}%`,
              bottom: "calc(100% + 6px)",
            }}
          >
            <p className="tabular-nums text-muted-foreground">
              {active.weekdayLabel} {active.full}
            </p>
            <p className="mt-0.5 tabular-nums">
              {active.count} {active.count === 1 ? "task" : "tasks"} due
            </p>
            <p className="text-faint">≈ {active.hours}h of work</p>
          </div>
        )}
      </div>

      <div className="mt-1.5 flex gap-[2px]">
        {points.map((p) => (
          <span
            key={p.dayKey}
            className="flex-1 text-center text-[9px] tabular-nums"
            style={{
              color: p.isToday
                ? "var(--foreground)"
                : p.isWeekend
                  ? "var(--text-faint)"
                  : "var(--muted-foreground)",
            }}
          >
            {p.isToday ? "Today" : p.short}
          </span>
        ))}
      </div>

      <p className="sr-only">
        {points.map((p) => `${p.full}: ${p.count} due.`).join(" ")}
      </p>
    </div>
  );
}
