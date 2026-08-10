/**
 * The board shows three columns for seven statuses.
 *
 * In progress and In review were dropped because nothing in the org has ever
 * been in them — every task is TODO or DONE. Their statuses still exist and the
 * API still writes them, so they fold into To do rather than being hidden: a
 * task that reaches IN_PROGRESS, BLOCKED or IN_REVIEW some other way stays
 * visible on the board instead of silently vanishing from it.
 *
 * BLOCKED is called out with a flag on the card. CANCELLED is off the board.
 *
 * `writes` is the status a drop into that column sets, and it is only applied
 * when the card changes column — so a folded card keeps its real status until
 * someone actually moves it somewhere else.
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
    accepts: ["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW"],
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

/**
 * Cards are keyed to their label's colour, falling back to priority so a card
 * is never colourless. Same hue can therefore mean two things depending on
 * whether the task is tagged — the label chip below the title is what
 * disambiguates.
 */
export const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "var(--status-red)",
  HIGH: "var(--status-amber)",
  MEDIUM: "var(--status-blue)",
  LOW: "#8b8b94",
};

export function accentFor(task: {
  labels: { color: string }[];
  priority: string;
}): string {
  return task.labels[0]?.color ?? PRIORITY_COLOR[task.priority] ?? "#8b8b94";
}

export type BoardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  blocked: boolean;
  /** Drives the people filter. Empty for an unassigned task. */
  assigneeIds: string[];
  /** Pre-formatted in IST by the server — see TaskBoard. */
  dueLabel: string | null;
  overdue: boolean;
  labels: { id: string; name: string; color: string }[];
  assignees: string[];
};
