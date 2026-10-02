import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  MessageSquare,
  PlusCircle,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  type ActivityKind,
  type ReportLabel,
  type TaskPriorityKey,
  type TaskStatusKey,
} from "@/lib/reports";

export const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  completed: CheckCircle2,
  progress: RefreshCw,
  ongoing: Clock3,
  comment: MessageSquare,
  added: PlusCircle,
  meeting: CalendarClock,
};

/** Status hues are the board's, so a status reads the same on every screen. */
export const KIND_COLOR: Record<ActivityKind, string> = {
  completed: "var(--status-green)",
  progress: "var(--status-blue)",
  ongoing: "var(--text-faint)",
  comment: "var(--muted-foreground)",
  added: "var(--status-purple)",
  meeting: "var(--status-amber)",
};

const STATUS_COLOR: Record<TaskStatusKey, string> = {
  BACKLOG: "var(--text-faint)",
  TODO: "var(--status-purple)",
  IN_PROGRESS: "var(--status-blue)",
  IN_REVIEW: "var(--status-blue)",
  BLOCKED: "var(--status-red)",
  DONE: "var(--status-green)",
  CANCELLED: "var(--text-faint)",
};

const PRIORITY_COLOR: Record<TaskPriorityKey, string> = {
  URGENT: "var(--status-red)",
  HIGH: "var(--status-amber)",
  MEDIUM: "var(--status-blue)",
  LOW: "var(--text-faint)",
};

export function StatusTag({ status }: { status: TaskStatusKey }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground">
      <span className="dot" style={{ backgroundColor: STATUS_COLOR[status] }} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityTag({ priority }: { priority: TaskPriorityKey }) {
  return (
    <span
      className="whitespace-nowrap text-[11px]"
      style={{ color: PRIORITY_COLOR[priority] }}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function LabelChips({ labels }: { labels: ReportLabel[] }) {
  if (labels.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {labels.map((l) => (
        <span
          key={l.id}
          className="label-chip"
          style={{ "--chip-color": l.color } as React.CSSProperties}
        >
          {l.name}
        </span>
      ))}
    </span>
  );
}
