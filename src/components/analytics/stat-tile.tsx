import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { STATUS } from "./palette";

export type Delta = {
  /** Change against the previous window of the same length. */
  value: number;
  /** Formatted for display — "+4", "−2 pts", "−1.5h". */
  label: string;
  /** Whether an increase is the good direction. */
  higherIsBetter: boolean;
};

/**
 * One headline number. A stat tile, not a one-bar chart — the number is the
 * chart, and the delta beside it carries the trend.
 *
 * The value uses proportional figures: tabular-nums makes a large standalone
 * number read loose. The tiny delta beside it keeps tabular alignment.
 */
export function StatTile({
  label,
  value,
  suffix,
  hint,
  delta,
  tone,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  hint?: string;
  delta?: Delta | null;
  /** A reserved status colour, when the number itself means "this is bad". */
  tone?: keyof typeof STATUS;
}) {
  const Icon =
    !delta || delta.value === 0
      ? Minus
      : delta.value > 0
        ? TrendingUp
        : TrendingDown;

  const good = delta
    ? delta.value === 0
      ? null
      : delta.value > 0 === delta.higherIsBetter
    : null;

  const deltaColor =
    good === null ? "var(--text-faint)" : good ? STATUS.good : STATUS.critical;

  return (
    <div className="stat">
      <p className="truncate text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </p>

      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className="text-[26px] font-semibold leading-none tracking-tight"
          style={tone ? { color: STATUS[tone] } : undefined}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-[12px] text-muted-foreground">{suffix}</span>
        )}
      </div>

      <div className="mt-2 flex min-h-4 items-center gap-1.5 text-[11px]">
        {delta ? (
          <>
            <Icon size={11} style={{ color: deltaColor }} />
            <span className="tabular-nums" style={{ color: deltaColor }}>
              {delta.label}
            </span>
            <span className="truncate text-faint">vs previous</span>
          </>
        ) : (
          hint && <span className="truncate text-faint">{hint}</span>
        )}
      </div>
    </div>
  );
}
