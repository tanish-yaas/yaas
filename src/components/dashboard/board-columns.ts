/**
 * The board shows five columns for seven statuses.
 *
 * BLOCKED rides in the In progress column and is called out with a flag on the
 * card instead of getting a column of its own — it is a state a task is stuck
 * in, not a stage it moves through. CANCELLED is left off the board entirely.
 *
 * `writes` is the status a drop into that column sets. Every column writes a
 * real status, so nothing is invented on drop; the only lossy move is dragging
 * a BLOCKED card into In progress from elsewhere, which clears the flag.
 *
 * Shared by the server page (which groups the rows) and the client board, so
 * the two cannot drift apart.
 */
export type BoardColumn = {
  key: string;
  label: string;
  color: string;
  /** Status written when a card is dropped here. */
  writes: string;
  /** Statuses that land in this column. */
  accepts: string[];
};

export const BOARD_COLUMNS: BoardColumn[] = [
  {
    key: "backlog",
    label: "Backlog",
    color: "#8b8b94",
    writes: "BACKLOG",
    accepts: ["BACKLOG"],
  },
  {
    key: "todo",
    label: "To do",
    color: "var(--status-purple)",
    writes: "TODO",
    accepts: ["TODO"],
  },
  {
    key: "doing",
    label: "In progress",
    color: "var(--status-blue)",
    writes: "IN_PROGRESS",
    accepts: ["IN_PROGRESS", "BLOCKED"],
  },
  {
    key: "review",
    label: "In review",
    color: "var(--status-amber)",
    writes: "IN_REVIEW",
    accepts: ["IN_REVIEW"],
  },
  {
    key: "done",
    label: "Done",
    color: "var(--status-green)",
    writes: "DONE",
    accepts: ["DONE"],
  },
];

const COLUMN_BY_STATUS = new Map(
  BOARD_COLUMNS.flatMap((c) => c.accepts.map((s) => [s, c.key] as const))
);

/** null for statuses the board deliberately hides, i.e. CANCELLED. */
export function columnForStatus(status: string): string | null {
  return COLUMN_BY_STATUS.get(status) ?? null;
}

export type BoardTask = {
  id: string;
  title: string;
  status: string;
  blocked: boolean;
  /** Pre-formatted in IST by the server — see TaskBoard. */
  dueLabel: string | null;
  overdue: boolean;
  labels: { id: string; name: string; color: string }[];
  assignees: string[];
};
