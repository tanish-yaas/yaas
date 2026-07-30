import { CheckSquare, Clock, AlertTriangle, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import { SuggestionCard } from "@/components/dashboard/suggestion-card";
import type { SuggestionPayload } from "@/server/services/intelligence";

function greeting(timezone: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: timezone,
    }).format(new Date())
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="glass rounded-xl px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tracking-tight">
        {value}
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

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const endOfWeek = new Date(startOfDay);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const mine = {
    organizationId: orgId,
    deletedAt: null,
    assignments: { some: { userId } },
  };

  const [dueToday, dueThisWeek, overdue, completedThisWeek] = await Promise.all([
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
  ]);

  const recentTasks = await prisma.task.findMany({
    where: mine,
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true, status: true, dueAt: true },
  });

  const suggestions = await prisma.aISuggestion.findMany({
    where: {
      organizationId: orgId,
      userId,
      status: "PENDING",
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
    take: 5,
  });

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {greeting(ctx.profile.timezone)},{" "}
          {ctx.profile.displayName?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Intl.DateTimeFormat("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: ctx.profile.timezone,
          }).format(now)}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Due today"
          value={dueToday}
          icon={<CheckSquare size={15} />}
          accent="#7C5CFF"
        />
        <Stat
          label="This week"
          value={dueThisWeek}
          icon={<Clock size={15} />}
          accent="#22D3EE"
        />
        <Stat
          label="Overdue"
          value={overdue}
          icon={<AlertTriangle size={15} />}
          accent="#FF4D6D"
        />
        <Stat
          label="Completed"
          value={completedThisWeek}
          icon={<CheckSquare size={15} />}
          accent="#4ADE80"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="glass rounded-xl px-5 py-5 lg:col-span-2">
          <h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Recent tasks
          </h2>
          {recentTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-sm text-muted-foreground">No tasks yet</p>
              <p className="max-w-xs text-xs text-muted-foreground/70">
                Anything assigned to you shows up here.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border/60">
              {recentTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <span className="truncate text-sm">{task.title}</span>
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[10px] text-muted-foreground">
                    {task.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass rounded-xl px-5 py-5">
          <h2 className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles size={13} className="text-brand-violet" />
            Suggestions
          </h2>
          {suggestions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-sm text-muted-foreground">Nothing to flag</p>
              <p className="text-xs text-muted-foreground/70">
                YAAS reviews your workload nightly and surfaces anything worth a
                look.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => {
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
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}