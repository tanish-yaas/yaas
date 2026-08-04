import Link from "next/link";
import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import { buildTaskScope } from "@/server/services/tasks";
import { toLocalInput, formatIST } from "@/lib/dates";
import { TaskComposer } from "@/components/tasks/task-composer";
import { SmartComposer } from "@/components/tasks/smart-composer";
import { TaskRow, type TaskRowData } from "@/components/tasks/task-row";

function Section({
  title,
  tasks,
  accent,
}: {
  title: string;
  tasks: TaskRowData[];
  accent?: string;
}) {
  if (tasks.length === 0) return null;
  return (
    <section className="mt-6">
      <h2
        className="mb-1 px-3 text-xs uppercase tracking-[0.2em]"
        style={{ color: accent ?? "var(--muted-foreground)" }}
      >
        {title} · {tasks.length}
      </h2>
      <div className="glass rounded-xl px-1.5 py-1.5">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </div>
    </section>
  );
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ label?: string; team?: string }>;
}) {
  const { label: labelFilter, team: teamFilter } = await searchParams;
  const ctx = await getCurrentContext();
  if (!ctx?.membership) return null;

  const orgId = ctx.membership.organizationId;
  const userId = ctx.session.user.id;

  const scope = await buildTaskScope(orgId, userId, ctx.permissions);

  const [tasks, memberRows, subtaskCounts, labels, teams] = await Promise.all([
    prisma.task.findMany({
      // Subtasks live inside the parent's detail sheet, not as top-level rows.
      where: {
        ...scope,
        parentTaskId: null,
        ...(labelFilter
          ? { labels: { some: { labelId: labelFilter } } }
          : {}),
        ...(teamFilter ? { teamId: teamFilter } : {}),
      },
      orderBy: [
        { status: "asc" },
        { priorityScore: "desc" },
        { createdAt: "desc" },
      ],
      take: 200,
      include: {
        assignments: { include: { user: { select: { name: true } } } },
        labels: { include: { label: true } },
      },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.task.groupBy({
      by: ["parentTaskId", "status"],
      where: { ...scope, parentTaskId: { not: null } },
      _count: { _all: true },
    }),
    prisma.label.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.team.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  // A task is blocked while any task it depends on is still open.
  const dependencies =
    tasks.length > 0
      ? await prisma.taskDependency.findMany({
          where: {
            organizationId: orgId,
            type: "BLOCKS",
            taskId: { in: tasks.map((t) => t.id) },
            dependsOn: { deletedAt: null },
          },
          select: { taskId: true, dependsOn: { select: { status: true } } },
        })
      : [];

  const blockers = new Map<string, { open: number; total: number }>();
  for (const dep of dependencies) {
    const entry = blockers.get(dep.taskId) ?? { open: 0, total: 0 };
    entry.total += 1;
    if (dep.dependsOn.status !== "DONE" && dep.dependsOn.status !== "CANCELLED") {
      entry.open += 1;
    }
    blockers.set(dep.taskId, entry);
  }

  const progress = new Map<string, { done: number; total: number }>();
  for (const row of subtaskCounts) {
    if (!row.parentTaskId) continue;
    const entry = progress.get(row.parentTaskId) ?? { done: 0, total: 0 };
    entry.total += row._count._all;
    if (row.status === "DONE") entry.done += row._count._all;
    progress.set(row.parentTaskId, entry);
  }

  const members = memberRows.map((m) => ({
    userId: m.userId,
    name: m.user.name ?? m.user.email ?? "Member",
  }));

  /** Keep whichever filter isn't being toggled. */
  const filterHref = (next: { label?: string | null; team?: string | null }) => {
    const params = new URLSearchParams();
    const label = next.label === undefined ? labelFilter : next.label;
    const team = next.team === undefined ? teamFilter : next.team;
    if (label) params.set("label", label);
    if (team) params.set("team", team);
    const query = params.toString();
    return query ? `/tasks?${query}` : "/tasks";
  };

  const now = new Date();
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const dueMap = new Map(tasks.map((t) => [t.id, t.dueAt]));

  const rows: TaskRowData[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    status: t.status,
    priority: t.priority,
    dueAtInput: toLocalInput(t.dueAt),
    dueAtLabel: formatIST(t.dueAt),
    estimatedMinutes: t.estimatedMinutes ? String(t.estimatedMinutes) : "",
    overdue: !!t.dueAt && t.dueAt < now,
    assignees: t.assignments.map((a) => a.user.name ?? "").filter(Boolean),
    subtasks: progress.get(t.id),
    labels: t.labels.map((l) => ({
      id: l.label.id,
      name: l.label.name,
      color: l.label.color,
    })),
    blockedBy: blockers.get(t.id)?.open ?? 0,
    readyToStart:
      (blockers.get(t.id)?.total ?? 0) > 0 &&
      (blockers.get(t.id)?.open ?? 0) === 0,
  }));

  const open = rows.filter(
    (r) => r.status !== "DONE" && r.status !== "CANCELLED"
  );
  const done = rows.filter((r) => r.status === "DONE");

  const overdue = open.filter((r) => r.overdue);
  const today = open.filter((r) => {
    if (r.overdue) return false;
    const due = dueMap.get(r.id);
    return !!due && due <= endOfToday;
  });
  const later = open.filter(
    (r) => !r.overdue && r.dueAtLabel !== null && !today.includes(r)
  );
  const undated = open.filter((r) => r.dueAtLabel === null);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Tasks
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {open.length} open · {done.length} done
        </p>
      </header>

      {ctx.permissions.has("ai.use") ? (
        <div className="flex flex-col gap-3">
          <SmartComposer
            members={members}
            currentUserId={userId}
            labels={labels}
          />
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground">
              Add manually instead
            </summary>
            <div className="mt-2">
              <TaskComposer
                members={members}
                currentUserId={userId}
                labels={labels}
                teams={teams}
              />
            </div>
          </details>
        </div>
      ) : (
        <TaskComposer
          members={members}
          currentUserId={userId}
          labels={labels}
          teams={teams}
        />
      )}

      {(labels.length > 0 || teams.length > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Link
            href="/tasks"
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              labelFilter || teamFilter
                ? "border-border text-muted-foreground hover:text-foreground"
                : "border-brand-violet/40 bg-brand-violet/10 text-brand-violet"
            }`}
          >
            All
          </Link>

          {teams.map((team) => {
            const active = teamFilter === team.id;
            const color = team.color ?? "#7C5CFF";
            return (
              <Link
                key={team.id}
                href={filterHref({ team: active ? null : team.id })}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-opacity hover:opacity-80"
                style={{
                  color,
                  borderColor: `color-mix(in oklab, ${color} ${
                    active ? "60%" : "25%"
                  }, transparent)`,
                  backgroundColor: active
                    ? `color-mix(in oklab, ${color} 18%, transparent)`
                    : "transparent",
                }}
              >
                <Users size={10} />
                {team.name}
              </Link>
            );
          })}

          {labels.map((label) => {
            const active = labelFilter === label.id;
            return (
              <Link
                key={label.id}
                href={filterHref({ label: active ? null : label.id })}
                className="rounded-full border px-2.5 py-1 text-[11px] transition-opacity hover:opacity-80"
                style={{
                  color: label.color,
                  borderColor: `color-mix(in oklab, ${label.color} ${
                    active ? "60%" : "25%"
                  }, transparent)`,
                  backgroundColor: active
                    ? `color-mix(in oklab, ${label.color} 18%, transparent)`
                    : "transparent",
                }}
              >
                {label.name}
              </Link>
            );
          })}
        </div>
      )}

      {rows.length === 0 && (
        <div className="glass mt-6 flex flex-col items-center gap-2 rounded-xl py-14 text-center">
          <p className="text-sm text-muted-foreground">Nothing here yet</p>
          <p className="max-w-xs text-xs text-muted-foreground/70">
            Describe a task above in plain language and YAAS will structure it.
          </p>
        </div>
      )}

      <Section title="Overdue" tasks={overdue} accent="#FF4D6D" />
      <Section title="Today" tasks={today} />
      <Section title="Upcoming" tasks={later} />
      <Section title="No date" tasks={undated} />
      <Section title="Done" tasks={done} />
    </div>
  );
}