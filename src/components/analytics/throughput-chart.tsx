"use client";

import { useMemo, useState } from "react";
import { Table2, LineChart } from "lucide-react";
import { GRID, SERIES, SURFACE } from "./palette";

export type ThroughputPoint = {
  dayKey: string;
  /** "02/09" — formatted on the server, which is the side that knows it is IST. */
  short: string;
  /** "02/09/2026" for the tooltip and the table. */
  full: string;
  created: number;
  completed: number;
};

const SERIES_META = [
  { key: "created", label: "Created", color: SERIES[0] },
  { key: "completed", label: "Completed", color: SERIES[1] },
] as const;

/** A round ceiling, so the top gridline is a number a reader recognises. */
function ceiling(max: number): number {
  if (max <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= max) return candidate;
  }
  return 10 * magnitude;
}

/**
 * Created against completed, one point per day.
 *
 * Two series on ONE axis — both are task counts, so they share a scale. Never
 * a second y-axis: the alignment between two scales is arbitrary and invents a
 * correlation the data does not have.
 */
export function ThroughputChart({ points }: { points: ThroughputPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const max = useMemo(
    () => ceiling(Math.max(1, ...points.flatMap((p) => [p.created, p.completed]))),
    [points]
  );

  const n = points.length;
  // Percentage coordinates: the SVG is a 0–100 box stretched to the container,
  // so nothing here has to know a pixel — and nothing breaks under the
  // interface scale, which is applied as zoom on the root.
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (value: number) => 100 - (value / max) * 100;

  const path = (key: "created" | "completed") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p[key])}`).join(" ");

  const last = points[n - 1];
  // Endpoint labels are the direct labels. Two of them collide when the series
  // finish close together, so in that case the legend carries identity alone.
  const labelsFit = last ? Math.abs(y(last.created) - y(last.completed)) > 14 : false;

  const totals = SERIES_META.map((s) => ({
    ...s,
    total: points.reduce((sum, p) => sum + p[s.key], 0),
  }));

  const active = hover === null ? null : points[hover];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Legend — always present at two or more series, so identity is never
            carried by colour alone. */}
        {totals.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[11px]">
            <span
              className="h-[3px] w-3 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="tabular-nums text-faint">{s.total}</span>
          </span>
        ))}

        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="ml-auto flex items-center gap-1.5 text-[11px] text-faint transition-colors hover:text-foreground"
        >
          {asTable ? <LineChart size={12} /> : <Table2 size={12} />}
          {asTable ? "Chart" : "Table"}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[var(--card)] text-left text-[10px] uppercase tracking-[0.12em] text-faint">
              <tr>
                <th className="py-1.5 font-normal">Day</th>
                <th className="py-1.5 text-right font-normal">Created</th>
                <th className="py-1.5 text-right font-normal">Completed</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {[...points].reverse().map((p) => (
                <tr
                  key={p.dayKey}
                  className="border-t border-[color-mix(in_oklab,white_5%,transparent)]"
                >
                  <td className="py-1.5 tabular-nums">{p.full}</td>
                  <td className="py-1.5 text-right tabular-nums">{p.created}</td>
                  <td className="py-1.5 text-right tabular-nums">
                    {p.completed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Y ticks live in HTML, not SVG text — the plot box is stretched to
              the container and would stretch the glyphs with it. */}
          <div className="relative h-40 w-7 shrink-0">
            {[max, max / 2, 0].map((tick, i) => (
              <span
                key={tick}
                className="absolute right-0 -translate-y-1/2 text-[10px] tabular-nums text-faint"
                style={{ top: `${i * 50}%` }}
              >
                {Number.isInteger(tick) ? tick : tick.toFixed(1)}
              </span>
            ))}
          </div>

          {/* pr-8 reserves the room the endpoint labels sit in. Without it a
              three-digit label at left:100% is clipped by the panel, which is
              the one thing a chart label must never be. */}
          <div className="min-w-0 flex-1 pr-8">
            <div className="relative h-40">
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                role="img"
                aria-label={`Tasks created and completed per day over the last ${n} days`}
                className="h-full w-full overflow-visible"
              >
                {[0, 50, 100].map((pos) => (
                  <line
                    key={pos}
                    x1="0"
                    x2="100"
                    y1={pos}
                    y2={pos}
                    stroke={GRID}
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}

                {SERIES_META.map((s) => (
                  <path
                    key={s.key}
                    d={path(s.key)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>

              {/* Crosshair and markers are HTML, so a marker stays a circle
                  however wide the container gets. */}
              {active && (
                <>
                  <div
                    aria-hidden
                    className="pointer-events-none absolute top-0 h-full w-px"
                    style={{
                      left: `${x(hover!)}%`,
                      backgroundColor: "color-mix(in oklab, white 20%, transparent)",
                    }}
                  />
                  {SERIES_META.map((s) => (
                    <div
                      key={s.key}
                      aria-hidden
                      className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        left: `${x(hover!)}%`,
                        top: `${y(active[s.key])}%`,
                        backgroundColor: s.color,
                        // A 2px surface ring, not a border — marks that
                        // overlap stay legible without a stroke around them.
                        boxShadow: `0 0 0 2px ${SURFACE}`,
                      }}
                    />
                  ))}
                </>
              )}

              {/* Selective direct labels: the endpoint only, and only when the
                  two would not sit on top of each other. */}
              {labelsFit &&
                last &&
                SERIES_META.map((s) => (
                  <span
                    key={s.key}
                    className="pointer-events-none absolute -translate-y-1/2 whitespace-nowrap pl-1 text-[10px] tabular-nums text-muted-foreground"
                    style={{ left: "100%", top: `${y(last[s.key])}%` }}
                  >
                    {last[s.key]}
                  </span>
                ))}

              {/* Full-height hit bands — the target is the column, not the
                  2px line, so there is nothing to land on dead-centre. */}
              <div className="absolute inset-0 flex">
                {points.map((p, i) => (
                  <button
                    key={p.dayKey}
                    type="button"
                    tabIndex={-1}
                    aria-label={`${p.full}: ${p.created} created, ${p.completed} completed`}
                    className="h-full flex-1"
                    onPointerEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onPointerLeave={() => setHover(null)}
                    onBlur={() => setHover(null)}
                  />
                ))}
              </div>

              {active && (
                <div
                  className="overlay pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap px-2.5 py-1.5 text-[11px]"
                  style={{
                    left: `${Math.min(88, Math.max(12, x(hover!)))}%`,
                    bottom: "calc(100% + 6px)",
                  }}
                >
                  <p className="tabular-nums text-muted-foreground">
                    {active.full}
                  </p>
                  {SERIES_META.map((s) => (
                    <p key={s.key} className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className="h-[3px] w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                        aria-hidden
                      />
                      <span className="text-faint">{s.label}</span>
                      <span className="ml-auto tabular-nums">
                        {active[s.key]}
                      </span>
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Ticks are placed at the x they name. Spreading them evenly with
                justify-between drifts a few percent off the points they label,
                which reads as the line being wrong. */}
            <div className="relative mt-1.5 h-3">
              {points.map((p, i) =>
                i % Math.ceil(n / 6) === 0 || i === n - 1 ? (
                  <span
                    key={p.dayKey}
                    className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] tabular-nums text-faint"
                    style={{
                      left: `${x(i)}%`,
                      // The end ticks would hang off their edges otherwise.
                      transform:
                        i === 0
                          ? "translateX(0)"
                          : i === n - 1
                            ? "translateX(-100%)"
                            : undefined,
                    }}
                  >
                    {p.short}
                  </span>
                ) : null
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
