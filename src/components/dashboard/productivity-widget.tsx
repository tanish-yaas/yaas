import { Activity, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ScoreTrend } from "@/server/services/snapshots";

const WIDTH = 220;
const HEIGHT = 44;

/** Sparkline path across the trend, skipping days with no snapshot. */
function sparkline(points: ScoreTrend["points"]) {
  const scored = points
    .map((p, i) => ({ ...p, i }))
    .filter((p) => p.score !== null);

  if (scored.length < 2) return null;

  const step = WIDTH / Math.max(1, points.length - 1);
  const y = (score: number) => HEIGHT - (score / 100) * (HEIGHT - 4) - 2;

  const line = scored
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.i * step} ${y(p.score!)}`)
    .join(" ");

  const area = `${line} L ${scored[scored.length - 1].i * step} ${HEIGHT} L ${
    scored[0].i * step
  } ${HEIGHT} Z`;

  return { line, area, last: scored[scored.length - 1] };
}

export function ProductivityWidget({ trend }: { trend: ScoreTrend }) {
  const chart = sparkline(trend.points);
  const change = trend.change;

  const tone =
    change === null || change === 0
      ? { color: "#8B8B9E", Icon: Minus }
      : change > 0
        ? { color: "#4ADE80", Icon: TrendingUp }
        : { color: "#FF4D6D", Icon: TrendingDown };

  return (
    <section className="glass rounded-xl px-5 py-5">
      <h2 className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <Activity size={13} className="text-brand-violet" />
        Productivity
      </h2>

      {trend.latest === null ? (
        <p className="text-xs text-muted-foreground/70">
          No snapshots yet. Nova records one each night — your score and trend
          appear here from tomorrow.
        </p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-3xl font-semibold tabular-nums tracking-tight">
                {trend.latest}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / 100
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Latest daily score
              </p>
            </div>

            <div
              className="flex items-center gap-1.5 text-xs"
              style={{ color: tone.color }}
              title="This week's average against the week before"
            >
              <tone.Icon size={13} />
              <span className="tabular-nums">
                {change === null
                  ? "—"
                  : `${change > 0 ? "+" : ""}${change} pts`}
              </span>
            </div>
          </div>

          {chart && (
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              preserveAspectRatio="none"
              role="img"
              aria-label="Daily productivity score over the last 14 days"
              className="mt-4 h-11 w-full"
            >
              <defs>
                <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={chart.area} fill="url(#spark)" />
              <path
                d={chart.line}
                fill="none"
                stroke="#7C5CFF"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}

          <p className="mt-2 text-[10px] text-muted-foreground/70">
            Last 14 days · avg {trend.average ?? "—"}
            {trend.previousAverage !== null &&
              ` vs ${trend.previousAverage} the week before`}
          </p>
        </>
      )}
    </section>
  );
}
