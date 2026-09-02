import { BarChart3 } from "lucide-react";
import { getCurrentContext } from "@/server/auth/session";
import {
  analyticsMembers,
  getAnalytics,
  resolveRange,
  resolveScope,
} from "@/server/services/analytics";
import { FUTURE_DAYS } from "@/components/analytics/types";
import {
  addDaysToKey,
  formatDayKey,
  formatDayKeyShort,
  istKeyToDate,
} from "@/lib/dates";
import { EmptyState } from "@/components/ui/empty-state";
import { ScopeBar } from "@/components/analytics/scope-bar";
import { StatTile } from "@/components/analytics/stat-tile";
import { ThroughputChart } from "@/components/analytics/throughput-chart";
import { LoadChart } from "@/components/analytics/load-chart";
import {
  BucketBars,
  MixBar,
  rampFor,
  type Segment,
} from "@/components/analytics/distribution";
import { PeopleTable } from "@/components/analytics/people-table";
import { SERIES, STATUS } from "@/components/analytics/palette";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Panel({
  title,
  note,
  children,
  className = "",
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel flex min-w-0 flex-col overflow-hidden ${className}`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-2.5">
        <h2 className="text-[11px] uppercase tracking-[0.12em] text-faint">
          {title}
        </h2>
        {note && <span className="shrink-0 text-[11px] text-faint">{note}</span>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function duration(hoursValue: number | null): string {
  if (hoursValue === null) return "—";
  if (hoursValue < 24) return `${Math.round(hoursValue)}h`;
  return `${Math.round((hoursValue / 24) * 10) / 10}d`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; user?: string; range?: string }>;
}) {
  const ctx = await getCurrentContext();
  if (!ctx?.membership) return null;

  // Reports are their own permission family. A member who can see the team's
  // tasks on the board is not automatically allowed to read a report about
  // how they are doing.
  if (!ctx.permissions.has("report.view_own")) {
    return (
      <div className="panel mx-auto w-full max-w-md">
        <EmptyState
          icon={BarChart3}
          title="Analytics is not available to you"
          description="Your role does not include reporting. An admin can grant it from Members."
        />
      </div>
    );
  }

  const orgId = ctx.membership.organizationId;
  const userId = ctx.session.user.id;

  const params = await searchParams;
  const scope = resolveScope(params, ctx.permissions);
  const rangeDays = resolveRange(params.range);

  const canSeeOthers =
    ctx.permissions.has("report.view_any") || ctx.permissions.has("report.view_team");

  const [data, members] = await Promise.all([
    getAnalytics(orgId, userId, ctx.permissions, { scope, rangeDays }),
    analyticsMembers(orgId, userId, ctx.permissions),
  ]);

  const { present, past, future } = data;

  const startKey = addDaysToKey(data.todayKey, -(rangeDays - 1));
  const subject =
    scope.kind === "everyone"
      ? "Everyone"
      : scope.kind === "user"
        ? (members.find((m) => m.userId === scope.userId)?.name ?? "Member")
        : "Your work";

  // ---- Chart inputs. Every date is formatted here, on the side that knows the
  // workspace runs on IST — a browser-side format would drift and mismatch on
  // hydration.

  const throughput = past.throughput.map((point) => ({
    ...point,
    short: formatDayKeyShort(point.dayKey),
    full: formatDayKey(point.dayKey),
  }));

  const load = future.load.map((point) => {
    const weekday = istKeyToDate(point.dayKey, 12).getUTCDay();
    return {
      ...point,
      short: formatDayKeyShort(point.dayKey),
      full: formatDayKey(point.dayKey),
      weekdayLabel: WEEKDAY_SHORT[weekday],
      isToday: point.dayKey === data.todayKey,
      isWeekend: weekday === 0 || weekday === 6,
      hours: Math.round((point.minutes / 60) * 10) / 10,
    };
  });

  // Pipeline stages take the ordinal ramp — the order is the meaning. Blocked
  // is a state, not a stage, so it keeps the reserved status colour and always
  // carries its label.
  const stages = data.pipeline.filter((s) => s.key !== "BLOCKED");
  const blocked = data.pipeline.find((s) => s.key === "BLOCKED");
  const stageRamp = rampFor(stages.length);
  const pipelineSegments: Segment[] = [
    ...stages.map((stage, i) => ({ ...stage, color: stageRamp[i] })),
    ...(blocked ? [{ ...blocked, color: STATUS.critical }] : []),
  ];

  const priorityRamp = rampFor(data.priority.length);
  const prioritySegments: Segment[] = data.priority.map((row, i) => ({
    ...row,
    // Reversed, so urgent takes the step that stands furthest off the surface.
    color: priorityRamp[priorityRamp.length - 1 - i],
  }));

  const agingRamp = rampFor(data.aging.length);
  const agingSegments: Segment[] = data.aging.map((row, i) => ({
    ...row,
    color: agingRamp[i],
  }));

  const weekdaySegments: Segment[] = past.byWeekday.map((row) => ({
    key: String(row.weekday),
    label: row.label,
    count: row.completed,
    color: SERIES[0],
  }));

  const onTimePct =
    past.onTimeRate === null ? null : Math.round(past.onTimeRate * 100);
  const previousOnTimePct =
    past.previous.onTimeRate === null
      ? null
      : Math.round(past.previous.onTimeRate * 100);

  const cycleDelta =
    past.medianCycleHours !== null && past.previous.medianCycleHours !== null
      ? Math.round((past.medianCycleHours - past.previous.medianCycleHours) * 10) /
        10
      : null;

  return (
    <div className="w-full">
      <ScopeBar
        scope={scope}
        rangeDays={rangeDays}
        members={members}
        canSeeOthers={canSeeOthers}
        selfId={userId}
      />

      <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h1 className="text-[18px] font-semibold tracking-tight">{subject}</h1>
        <p className="text-[12px] tabular-nums text-faint">
          {formatDayKey(startKey)} – {formatDayKey(data.todayKey)}
        </p>
      </div>

      {/* ---- Present ---------------------------------------------------- */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Open now"
          value={present.open}
          hint={`${present.noDueDate} with no date`}
        />
        <StatTile
          label="Overdue"
          value={present.overdue}
          tone={present.overdue > 0 ? "critical" : undefined}
          hint={
            present.blocked > 0
              ? `${present.blocked} blocked`
              : "nothing past due"
          }
        />
        <StatTile
          label="Due today"
          value={present.dueToday}
          hint={`${present.dueThisWeek} within 7 days`}
        />
        <StatTile
          label="Completed"
          value={past.completed}
          delta={{
            value: past.completed - past.previous.completed,
            label: `${past.completed - past.previous.completed >= 0 ? "+" : "−"}${Math.abs(past.completed - past.previous.completed)}`,
            higherIsBetter: true,
          }}
        />
        <StatTile
          label="On time"
          value={onTimePct === null ? "—" : onTimePct}
          suffix={onTimePct === null ? undefined : "%"}
          hint={
            past.withDeadline === 0
              ? "nothing closed with a deadline"
              : `${past.onTime} of ${past.withDeadline}`
          }
          delta={
            onTimePct !== null && previousOnTimePct !== null
              ? {
                  value: onTimePct - previousOnTimePct,
                  label: `${onTimePct - previousOnTimePct >= 0 ? "+" : "−"}${Math.abs(onTimePct - previousOnTimePct)} pts`,
                  higherIsBetter: true,
                }
              : null
          }
        />
        <StatTile
          label="Median cycle"
          value={duration(past.medianCycleHours)}
          hint={
            past.avgCycleHours === null
              ? "nothing closed yet"
              : `mean ${duration(past.avgCycleHours)}`
          }
          delta={
            cycleDelta !== null
              ? {
                  value: cycleDelta,
                  label: `${cycleDelta >= 0 ? "+" : "−"}${duration(Math.abs(cycleDelta))}`,
                  // Work that closes faster is the good direction.
                  higherIsBetter: false,
                }
              : null
          }
        />
      </div>

      {/* ---- Past ------------------------------------------------------- */}
      <Panel
        title="Created vs completed"
        note={`Last ${rangeDays} days`}
        className="mb-3"
      >
        <ThroughputChart points={throughput} />
      </Panel>

      <div className="mb-3 grid gap-3 lg:grid-cols-2">
        <Panel title="Open work by stage" note={`${present.open} open`}>
          <MixBar
            segments={pipelineSegments}
            total={present.open}
            emptyNote="Nothing open right now."
          />
        </Panel>

        <Panel title="Open work by priority" note={`${present.open} open`}>
          <MixBar
            segments={prioritySegments}
            total={present.open}
            emptyNote="Nothing open right now."
          />
        </Panel>
      </div>

      {/* ---- Future ----------------------------------------------------- */}
      <Panel
        title="What is coming"
        note={`Next ${FUTURE_DAYS} days · ≈${future.estimatedHours}h`}
        className="mb-3"
      >
        <LoadChart points={load} />

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[color-mix(in_oklab,white_7%,transparent)] pt-3 text-[12px]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-faint">
              At risk
            </p>
            <p className="mt-1 tabular-nums">
              <span
                style={future.atRisk > 0 ? { color: STATUS.warning } : undefined}
              >
                {future.atRisk}
              </span>
              <span className="ml-1.5 text-[11px] text-faint">
                due in 3 days, not started
              </span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-faint">
              Further out
            </p>
            <p className="mt-1 tabular-nums">
              {future.beyondWindow}
              <span className="ml-1.5 text-[11px] text-faint">
                dated beyond the window
              </span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-faint">
              Unscheduled
            </p>
            <p className="mt-1 tabular-nums">
              {future.unscheduled}
              <span className="ml-1.5 text-[11px] text-faint">
                open, no due date
              </span>
            </p>
          </div>
        </div>
      </Panel>

      <div className="mb-3 grid gap-3 lg:grid-cols-2">
        <Panel title="Overdue backlog" note="How late, and how much">
          <BucketBars
            segments={agingSegments}
            emptyNote="Nothing is past its deadline."
            unit="overdue"
          />
        </Panel>

        <Panel title="When work gets closed" note={`Last ${rangeDays} days`}>
          <BucketBars
            segments={weekdaySegments}
            emptyNote="Nothing closed in this window."
            unit="completed"
          />
        </Panel>
      </div>

      {(data.labels.length > 0 || data.sources.length > 0) && (
        <div className="mb-3 grid gap-3 lg:grid-cols-2">
          <Panel title="By label" note="Open · completed">
            {data.labels.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-faint">
                No labels on this work yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-[12px]">
                {data.labels.map((label) => (
                  <li key={label.id} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: label.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {label.name}
                    </span>
                    <span className="shrink-0 tabular-nums">{label.open}</span>
                    <span className="w-8 shrink-0 text-right tabular-nums text-faint">
                      {label.done}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Where tasks come from" note={`${present.open} open`}>
            {data.sources.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-faint">
                Nothing open right now.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-[12px]">
                {data.sources.map((source) => (
                  <li key={source.key} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {source.label}
                    </span>
                    <span className="h-1 w-24 overflow-hidden rounded-full bg-[color-mix(in_oklab,white_8%,transparent)]">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${(source.count / Math.max(1, present.open)) * 100}%`,
                          backgroundColor: SERIES[0],
                        }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-right tabular-nums">
                      {source.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {/* ---- Everyone ---------------------------------------------------- */}
      {data.people && data.people.length > 0 && (
        <Panel
          title="By person"
          note={`${data.people.length} ${data.people.length === 1 ? "person" : "people"}`}
        >
          <PeopleTable people={data.people} rangeDays={rangeDays} />
        </Panel>
      )}
    </div>
  );
}
