import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import { SuggestionCard } from "@/components/dashboard/suggestion-card";
import { InsightRow } from "@/components/dashboard/insight-row";
import { getDashboardInsights } from "@/server/services/insights";
import { TaskBoard } from "@/components/dashboard/task-board";
import {
  columnForStatus,
  type BoardTask,
} from "@/components/dashboard/board-columns";
import { APP_CONFIG } from "@/config/app";
import {
  addDaysToKey,
  daysBetweenKeys,
  formatIST,
  istDayKey,
  istKeyToDate,
  istTodayKey,
} from "@/lib/dates";
import type { SuggestionPayload } from "@/server/services/intelligence";

function greeting(tz: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: tz,
    }).format(new Date())
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Stat({
  label,
  value,
  total,
  color = "var(--primary)",
}: {
  label: string;
  value: number;
  total: number;
  color?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="stat">
      <p className="text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </p>
      <p
        className="mt-1.5 text-[28px] font-semibold leading-none tabular-nums"
        style={{ color: value > 0 ? color : "var(--foreground)" }}
      >
        {value}
      </p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[color-mix(in_oklab,white_8%,transparent)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-1.5 text-[10px] tabular-nums text-faint">
        {pct}% of {total}
      </p>
    </div>
  );
}

export default async function DashboardPage() {
  const ctx = await getCurrentContext();
  if (!ctx?.membership || !ctx.profile) return null;

  const orgId = ctx.membership.organizationId;
  const userId = ctx.session.user.id;
  const now = new Date();
  const tz = APP_CONFIG.timezone;

  // Day boundaries are IST wall-clock, not the server's. Vercel runs in UTC, so
  // setHours(0,0,0,0) here put "today" at 05:30–05:30 IST and quietly counted
  // the wrong tasks. Same reasoning as buildDigest in services/reminders.ts.
  const todayKey = istTodayKey();
  const startOfDay = istKeyToDate(todayKey);
  const endOfDay = istKeyToDate(addDaysToKey(todayKey, 1));
  const endOfWeek = istKeyToDate(addDaysToKey(todayKey, 7));

  const mine = {
    organizationId: orgId,
    deletedAt: null,
    assignments: { some: { userId } },
  };

  const [dueToday, dueThisWeek, overdue, completed, totalOpen] =
    await Promise.all([
      prisma.task.count({
        where: {
          ...mine,
          dueAt: { gte: startOfDay, lt: endOfDay },
          status: { not: "DONE" },
        },
      }),
      prisma.task.count({
        where: {
          ...mine,
          dueAt: { gte: startOfDay, lt: endOfWeek },
          status: { not: "DONE" },
        },
      }),
      prisma.task.count({
        where: { ...mine, dueAt: { lt: now }, status: { not: "DONE" } },
      }),
      prisma.task.count({
        where: {
          ...mine,
          status: "DONE",
          completedAt: { gte: startOfDay, lt: endOfWeek },
        },
      }),
      prisma.task.count({
        where: { ...mine, status: { notIn: ["DONE", "CANCELLED"] } },
      }),
    ]);

  const totalWeek = dueThisWeek + completed;

  const [boardRows, suggestions, insights] = await Promise.all([
    prisma.task.findMany({
      where: { ...mine, status: { not: "CANCELLED" } },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 120,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueAt: true,
        assignments: { select: { user: { select: { name: true } } } },
        labels: {
          select: { label: { select: { id: true, name: true, color: true } } },
        },
      },
    }),
    prisma.aISuggestion.findMany({
      where: {
        organizationId: orgId,
        userId,
        status: "PENDING",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
      take: 4,
    }),
    getDashboardInsights(orgId, userId),
  ]);

  // Formatted here rather than in the client board: the app is pinned to IST
  // and the browser is not, so a client-side format would drift and mismatch
  // on hydration. daysBetweenKeys is positive when the due day is behind today.
  const boardTasks: BoardTask[] = boardRows
    .filter((t) => columnForStatus(t.status) !== null)
    .map((t) => {
      const daysLate = t.dueAt
        ? daysBetweenKeys(istDayKey(t.dueAt), todayKey)
        : null;

      let dueLabel: string | null = null;
      if (daysLate !== null) {
        if (daysLate > 0) {
          dueLabel = `Due ${daysLate} ${daysLate === 1 ? "day" : "days"} ago`;
        } else if (daysLate === 0) {
          dueLabel = "Today";
        } else if (daysLate === -1) {
          dueLabel = "Tomorrow";
        } else {
          dueLabel = formatIST(t.dueAt, { day: "numeric", month: "short" });
        }
      }

      return {
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        blocked: t.status === "BLOCKED",
        dueLabel,
        overdue: daysLate !== null && daysLate > 0 && t.status !== "DONE",
        labels: t.labels.map((tl) => tl.label),
        assignees: t.assignments
          .map((a) => a.user.name?.split(" ")[0] ?? "")
          .filter(Boolean),
      };
    });

  return (
    // min-h-0 all the way down so the board can own the leftover height and
    // scroll its own columns, rather than growing the page.
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <header className="mb-4 shrink-0">
        <h1 className="text-[22px] font-semibold tracking-tight">
          {greeting(tz)}, {ctx.profile.displayName?.split(" ")[0]}
        </h1>
        <p className="mt-0.5 text-[13px] text-faint">
          {new Intl.DateTimeFormat("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: tz,
          }).format(now)}
        </p>
      </header>

      {/* Tiles keep their own row across the top. Below them the board takes
          the width and the height that is left, with suggestions in a rail. */}
      <div className="mb-3 grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Due today" value={dueToday} total={totalOpen || 1} />
        <Stat
          label="This week"
          value={dueThisWeek}
          total={totalOpen || 1}
          color="var(--status-blue)"
        />
        <Stat
          label="Overdue"
          value={overdue}
          total={totalOpen || 1}
          color="var(--status-red)"
        />
        <Stat
          label="Completed"
          value={completed}
          total={totalWeek || 1}
          color="var(--status-green)"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row">
        <section className="panel flex min-h-[380px] flex-1 flex-col overflow-hidden xl:min-h-0">
          <div className="flex shrink-0 items-center justify-between border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-2.5">
            <h2 className="text-[11px] uppercase tracking-[0.12em] text-faint">
              Board
            </h2>
            <span className="text-[11px] text-faint">
              {boardTasks.length === 0
                ? "No tasks yet"
                : "Drag to change status · click to open"}
            </span>
          </div>

          <div className="min-h-0 flex-1 p-3">
            <TaskBoard tasks={boardTasks} />
          </div>
        </section>

        <aside className="panel flex w-full shrink-0 flex-col overflow-hidden xl:w-[320px]">
          <div className="shrink-0 border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-2.5">
            <h2 className="text-[11px] uppercase tracking-[0.12em] text-faint">
              Suggestions
            </h2>
          </div>

          {/* Stored suggestions when any are pending, otherwise live insights.
              Without the fallback this panel sits empty most of the time — the
              nightly run is the only thing that fills it, and accepting or
              dismissing a row takes it straight back out. */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
            {suggestions.length > 0
              ? suggestions.map((s) => {
                  const payload = s.payload as SuggestionPayload | null;
                  return (
                    <SuggestionCard
                      key={s.id}
                      id={s.id}
                      type={s.type}
                      reason={s.reason ?? ""}
                      actionable={!!payload?.apply}
                    />
                  );
                })
              : insights.map((i) => (
                  <InsightRow key={i.key} type={i.type} text={i.text} />
                ))}
          </div>
        </aside>
      </div>
    </div>
  );
}