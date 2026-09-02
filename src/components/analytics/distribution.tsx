"use client";

import { useState } from "react";
import { inkOn, RAMP_4, RAMP_5 } from "./palette";

export type Segment = {
  key: string;
  label: string;
  count: number;
  color: string;
};

/**
 * Colours for an ordered set of categories — pipeline stages, priority, aging
 * buckets. One hue, light → dark, so the reader sees the order in the colour.
 * Ramps are capped at five steps; a sixth would put two adjacent steps under
 * the lightness-gap floor.
 */
export function rampFor(count: number): readonly string[] {
  return count <= 4 ? RAMP_4 : RAMP_5;
}

/**
 * Part-to-whole across ordered categories, in one bar.
 *
 * Segments are separated by a 2px gap painted in the surface colour rather
 * than a border — a stroke around every fill reads as chrome and thickens the
 * whole bar. The legend beneath carries every count, so no value depends on
 * the hover.
 */
export function MixBar({
  segments,
  total,
  emptyNote,
}: {
  segments: Segment[];
  total: number;
  emptyNote: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const shown = segments.filter((s) => s.count > 0);

  if (total === 0 || shown.length === 0) {
    return <p className="py-6 text-center text-[12px] text-faint">{emptyNote}</p>;
  }

  return (
    <div>
      {/* gap, not a border: a stroke around every fill reads as chrome and
          thickens the bar. Flex shrink is proportional to each item's width, so
          the 2px gaps come out of the segments without skewing the shares. */}
      <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-md">
        {shown.map((segment) => {
          const pct = (segment.count / total) * 100;
          const dim = hover !== null && hover !== segment.key;
          // A label only goes inside a segment when it actually fits with
          // padding; otherwise it lives in the legend and the tooltip.
          const fits = pct > 12;

          return (
            <button
              key={segment.key}
              type="button"
              title={`${segment.label}: ${segment.count} of ${total}`}
              onPointerEnter={() => setHover(segment.key)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(segment.key)}
              onBlur={() => setHover(null)}
              className="relative flex h-full items-center justify-center transition-opacity"
              style={{
                width: `${pct}%`,
                backgroundColor: segment.color,
                opacity: dim ? 0.45 : 1,
              }}
            >
              {fits && (
                <span
                  className="px-1 text-[10px] font-medium tabular-nums"
                  style={{ color: inkOn(segment.color) }}
                >
                  {segment.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* The legend is also the table view: every category, every count, every
          share — readable with no colour at all. */}
      <ul className="mt-3 flex flex-col gap-1.5">
        {segments.map((segment) => (
          <li
            key={segment.key}
            className="flex items-center gap-2 text-[12px]"
            onPointerEnter={() => setHover(segment.key)}
            onPointerLeave={() => setHover(null)}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{
                backgroundColor: segment.color,
                opacity: segment.count === 0 ? 0.35 : 1,
              }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {segment.label}
            </span>
            <span className="shrink-0 tabular-nums">{segment.count}</span>
            <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-faint">
              {total > 0 ? Math.round((segment.count / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Ordered buckets as horizontal bars — the form for "compare magnitude across
 * a handful of named categories" when the names are too long for an x-axis.
 */
export function BucketBars({
  segments,
  emptyNote,
  unit,
}: {
  segments: Segment[];
  emptyNote: string;
  unit: string;
}) {
  const max = Math.max(1, ...segments.map((s) => s.count));
  const total = segments.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    return <p className="py-6 text-center text-[12px] text-faint">{emptyNote}</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {segments.map((segment) => (
        <li key={segment.key} className="flex items-center gap-3 text-[12px]">
          <span className="w-24 shrink-0 truncate text-muted-foreground">
            {segment.label}
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className="h-2 rounded-[4px] transition-[width]"
              style={{
                width: `${Math.max((segment.count / max) * 100, segment.count > 0 ? 2 : 0)}%`,
                backgroundColor: segment.color,
              }}
            />
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {segment.count}
            </span>
          </span>
        </li>
      ))}
      <li className="mt-0.5 text-[11px] text-faint">
        {total} {unit} in total
      </li>
    </ul>
  );
}
