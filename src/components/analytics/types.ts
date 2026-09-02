/**
 * The shape of the analytics page, with nothing that reaches a database.
 *
 * The filter bar is a client component, so it cannot import from the service —
 * pulling in services/analytics.ts drags Prisma and the pg driver into the
 * browser bundle, which fails the build. Same split as components/calendar.
 */

/**
 * Whose work the numbers describe.
 *
 * "self" is what every member gets. The other two need a report.view_* wider
 * than own, and are narrowed a second time by buildTaskScope — the permission
 * says a viewer may read reports about other people, the task scope says which
 * people's rows they can actually see. Both have to agree.
 */
export type AnalyticsScopeKind = "self" | "everyone" | "user";

export type AnalyticsScope =
  | { kind: "self" }
  | { kind: "everyone" }
  | { kind: "user"; userId: string };

export const RANGE_DAYS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];

/** How far ahead the "what's coming" charts look. */
export const FUTURE_DAYS = 14;

/** Open work, in the order it moves through the board. */
export const PIPELINE_STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
] as const;

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const AGING_BUCKETS = [
  { key: "1-3", label: "1–3 days", min: 1, max: 3 },
  { key: "4-7", label: "4–7 days", min: 4, max: 7 },
  { key: "8-30", label: "8–30 days", min: 8, max: 30 },
  { key: "30+", label: "Over 30 days", min: 31, max: Infinity },
] as const;

export type Counted = { key: string; label: string; count: number };

export type PersonStats = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  image: string | null;
  open: number;
  overdue: number;
  completed: number;
  onTimeRate: number | null;
  medianCycleHours: number | null;
  dueThisWeek: number;
};

export type AnalyticsData = {
  todayKey: string;
  rangeDays: RangeDays;
  scope: AnalyticsScope;

  /** Right now. */
  present: {
    open: number;
    overdue: number;
    dueToday: number;
    dueThisWeek: number;
    blocked: number;
    unassigned: number;
    noDueDate: number;
  };

  /** The window behind us. */
  past: {
    created: number;
    completed: number;
    onTime: number;
    withDeadline: number;
    onTimeRate: number | null;
    medianCycleHours: number | null;
    avgCycleHours: number | null;
    /** Same-length window immediately before, for the deltas on the tiles. */
    previous: {
      created: number;
      completed: number;
      onTimeRate: number | null;
      medianCycleHours: number | null;
    };
    /** Oldest day first. */
    throughput: { dayKey: string; created: number; completed: number }[];
    /** Which day of the week work actually lands on. Sunday first. */
    byWeekday: { weekday: number; label: string; completed: number }[];
  };

  /** The window ahead. */
  future: {
    /** Today first, FUTURE_DAYS long. */
    load: { dayKey: string; count: number; minutes: number }[];
    beyondWindow: number;
    unscheduled: number;
    atRisk: number;
    estimatedHours: number;
  };

  pipeline: Counted[];
  priority: Counted[];
  aging: Counted[];
  labels: { id: string; name: string; color: string; open: number; done: number }[];
  sources: Counted[];

  /** Null unless the viewer may read past their own work. */
  people: PersonStats[] | null;
};
