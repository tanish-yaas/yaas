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

export default async function TasksPage() {
  const ctx = await getCurrentContext();
  if (!ctx?.membership) return null;

  const orgId = ctx.membership.organizationId;
  const userId = ctx.session.user.id;

  const scope = await buildTaskScope(orgId, userId, ctx.permissions);

  const [tasks, memberRows] = await Promise.all([
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
      },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
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
          <SmartComposer members={members} currentUserId={userId} />
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground">
              Add manually instead
            </summary>
            <div className="mt-2">
              <TaskComposer members={members} currentUserId={userId} />
            </div>
          </details>
        </div>
      ) : (
        <TaskComposer members={members} currentUserId={userId} />
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