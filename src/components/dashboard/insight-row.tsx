import {
  AlertOctagon,
  CalendarClock,
  Scale,
  Split,
  TrendingUp,
} from "lucide-react";

const ICONS: Record<string, React.ReactNode> = {
  TASK_PRIORITY: <TrendingUp size={13} />,
  DEADLINE_ADJUSTMENT: <CalendarClock size={13} />,
  WORKLOAD_REBALANCE: <Scale size={13} />,
  ROADBLOCK_RESOLUTION: <AlertOctagon size={13} />,
  TASK_BREAKDOWN: <Split size={13} />,
};

const ACCENTS: Record<string, string> = {
  TASK_PRIORITY: "#22D3EE",
  DEADLINE_ADJUSTMENT: "#FF4D6D",
  WORKLOAD_REBALANCE: "#F5B544",
  ROADBLOCK_RESOLUTION: "#FF4D8F",
  TASK_BREAKDOWN: "#7C5CFF",
};

/**
 * Read-only sibling of SuggestionCard. Shares its icons and accents so the two
 * sit together, but carries no accept/dismiss: an insight is derived on every
 * render and has no row behind it to act on.
 */
export function InsightRow({ type, text }: { type: string; text: string }) {
  const accent = ACCENTS[type] ?? "#7C5CFF";

  return (
    <div className="flex gap-2.5 rounded-lg border border-border/60 px-3 py-2.5">
      <span className="mt-0.5 shrink-0" style={{ color: accent }}>
        {ICONS[type] ?? <TrendingUp size={13} />}
      </span>
      <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
        {text}
      </p>
    </div>
  );
}
