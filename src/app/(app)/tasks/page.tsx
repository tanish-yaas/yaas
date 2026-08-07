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
  allLabels,
}: {
  title: string;
  tasks: TaskRowData[];
  allLabels: { id: string; name: string; color: string }[];
}) {
  if (tasks.length === 0) return null;
  return (
    <section className="mt-7">
      <h2 className="mb-1 px-2 text-[11px] uppercase tracking-[0.05em] text-faint">
        {title}
        <span className="ml-1.5 tabular-nums">{tasks.length}</span>
      </h2>
      <div className="border-t border-border">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} allLabels={allLabels} />
        ))}
      </div>
    </section>
  );
}

export default async function TasksPage() {
  const ctx = await getCurrentContext();
  if (!ctx?.membership) return null;

  const orgId = ctx.membership.organizationId;
  const userId = ctx.session.user.id;
  const scope = await buildTaskScope(orgId, userId, ctx.permissions);

  const [tasks, memberRows, labelRows, teamRows] = await Promise.all([
    prisma.task.findMany({
      where: scope,
      orderBy: [
        { status: "asc" },
        { priorityScore: "desc" },
        { createdAt: "desc" },
      ],
      take: 200,
      include: {
        assignments: { include: { user: { select: { name: true } } } },
        labels: {
          include: {
            label: { select: { id: true, name: true, color: true } },
          },
        },
      },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.label.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.team.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const members = memberRows.map((m) => ({
    userId: m.userId,
    name: m.user.name ?? m.user.email ?? "Member",
  }));

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
    labels: t.labels.map((tl) => tl.label),
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
        <h1 className="text-2xl font-semibold">Tasks</h1>
        <p className="mt-0.5 text-[13px] text-faint">
          {open.length} open · {done.length} done
        </p>
      </header>

      {ctx.permissions.has("ai.use") ? (
        <div className="flex flex-col gap-2">
          <SmartComposer
            members={members}
            currentUserId={userId}
            labels={labelRows}
          />
          <details>
            <summary className="cursor-pointer text-[12px] text-faint transition-colors hover:text-foreground">
              Add manually
            </summary>
            <div className="mt-2">
              <TaskComposer
                members={members}
                currentUserId={userId}
                labels={labelRows}
                teams={teamRows}
              />
            </div>
          </details>
        </div>
      ) : (
        <TaskComposer
          members={members}
          currentUserId={userId}
          labels={labelRows}
          teams={teamRows}
        />
      )}

      {rows.length === 0 && (
        <p className="mt-10 text-center text-[13px] text-faint">
          No tasks yet. Describe one above in plain language.
        </p>
      )}

      <Section title="Overdue" tasks={overdue} allLabels={labelRows} />
      <Section title="Today" tasks={today} allLabels={labelRows} />
      <Section title="Upcoming" tasks={later} allLabels={labelRows} />
      <Section title="No date" tasks={undated} allLabels={labelRows} />
      <Section title="Done" tasks={done} allLabels={labelRows} />
    </div>
  );
}