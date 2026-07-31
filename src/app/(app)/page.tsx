import {
  CheckSquare,
  Clock,
  AlertTriangle,
  Sparkles,
  Inbox,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import { SuggestionCard } from "@/components/dashboard/suggestion-card";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion/fade-in";
import { APP_CONFIG } from "@/config/app";
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
    <div className="glass group rounded-xl px-5 py-4 transition-colors hover:border-white/[0.14]">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span
          className="transition-transform group-hover:scale-110"
          style={{ color: accent }}
        >
          {icon}
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums tracking-tight">
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
  const tz = APP_CONFIG.timezone;

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

  const [recentTasks, suggestions] = await Promise.all([
    prisma.task.findMany({
      where: mine,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, dueAt: true },
    }),
    prisma.aISuggestion.findMany({
      where: {
        organizationId: orgId,
        userId,
        status: "PENDING",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <FadeIn>
        <header className="mb-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {greeting(tz)}, {ctx.profile.displayName?.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Intl.DateTimeFormat("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: tz,
            }).format(now)}
          </p>
        </header>
      </FadeIn>

      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <Stat
            label="Due today"
            value={dueToday}
            icon={<CheckSquare size={15} />}
            accent="#7C5CFF"
          />
        </StaggerItem>
        <StaggerItem>
          <Stat
            label="This week"
            value={dueThisWeek}
            icon={<Clock size={15} />}
            accent="#22D3EE"
          />
        </StaggerItem>
        <StaggerItem>
          <Stat
            label="Overdue"
            value={overdue}
            icon={<AlertTriangle size={15} />}
            accent="#FF4D6D"
          />
        </StaggerItem>
        <StaggerItem>
          <Stat
            label="Completed"
            value={completedThisWeek}
            icon={<CheckSquare size={15} />}
            accent="#4ADE80"
          />
        </StaggerItem>
      </Stagger>

      <FadeIn delay={0.15}>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <section className="glass rounded-xl px-5 py-5 lg:col-span-2">
            <h2 className="mb-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Recent tasks
            </h2>
            {recentTasks.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No tasks yet"
                description="Anything assigned to you appears here. Try describing one in plain language on the Tasks page."
              />
            ) : (
              <ul className="flex flex-col divide-y divide-border/60">
                {recentTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <span className="truncate text-sm">{task.title}</span>
                    <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[10px] text-muted-foreground">
                      {task.status.replace("_", " ")}
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
              <EmptyState
                icon={Sparkles}
                title="Nothing to flag"
                description="YAAS reviews your workload nightly and surfaces anything worth a look."
              />
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
      </FadeIn>
    </div>
  );
}