import {
  AlertOctagon,
  CalendarClock,
  Scale,
  Split,
  Sparkles,
  TrendingUp,
} from "lucide-react";

/**
 * One icon and one accent per suggestion type, shared by the rail card, the
 * topbar hint, the insight row and the detail sheet.
 *
 * These four used to each carry their own copy, and they had already drifted:
 * the rail used raw hexes while the topbar used the status tokens, so the same
 * suggestion was a different colour depending on where you saw it. Tokens win —
 * they follow the theme.
 */
const ACCENTS: Record<string, string> = {
  TASK_PRIORITY: "var(--status-blue)",
  DEADLINE_ADJUSTMENT: "var(--status-red)",
  WORKLOAD_REBALANCE: "var(--status-amber)",
  ROADBLOCK_RESOLUTION: "var(--status-purple)",
  TASK_BREAKDOWN: "var(--primary)",
  SCHEDULE_SLOT: "var(--status-green)",
};

const ICONS: Record<
  string,
  (size: number) => React.ReactNode
> = {
  TASK_PRIORITY: (size) => <TrendingUp size={size} />,
  DEADLINE_ADJUSTMENT: (size) => <CalendarClock size={size} />,
  WORKLOAD_REBALANCE: (size) => <Scale size={size} />,
  ROADBLOCK_RESOLUTION: (size) => <AlertOctagon size={size} />,
  TASK_BREAKDOWN: (size) => <Split size={size} />,
  SCHEDULE_SLOT: (size) => <CalendarClock size={size} />,
};

export function accentForSuggestion(type: string): string {
  return ACCENTS[type] ?? "var(--primary)";
}

export function iconForSuggestion(type: string, size = 13): React.ReactNode {
  const make = ICONS[type];
  return make ? make(size) : <Sparkles size={size} />;
}
