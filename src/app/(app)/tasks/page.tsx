import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import { buildTaskScope } from "@/server/services/tasks";
import {
  toLocalInput,
  formatIST,
  istKeyToDate,
  istTodayKey,
} from "@/lib/dates";
import { TaskComposer } from "@/components/tasks/task-composer";
import { SmartComposer } from "@/components/tasks/smart-composer";
import {
  TaskRow,
  type SubtaskRowData,
  type TaskRowData,
} from "@/components/tasks/task-row";
import { FocusZone } from "@/components/tasks/focus-zone";
import { isStorageConfigured } from "@/lib/storage";

function Section({ title, tasks }: { title: string; tasks: TaskRowData[] }) {
  if (tasks.length === 0) return null;
  return (
    <section className="mt-7">
      <h2 className="mb-1 px-2 text-[11px] uppercase tracking-[0.05em] text-faint">
        {title}
        <span className="ml-1.5 tabular-nums">{tasks.length}</span>
      </h2>
      <div className="border-t border-border">
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

  // Voice notes ride the attachment path, so without object storage there is
  // nowhere to put one — the recorder stays hidden rather than failing on save.
  const storageReady = isStorageConfigured();

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

  // Day bounds come from the IST calendar day, not the server's clock — the
  // server runs in UTC, where setHours(23,59) is half past five tomorrow
  // morning here.
  const todayKey = istTodayKey();
  const startOfToday = istKeyToDate(todayKey);
  const endOfToday = istKeyToDate(todayKey, 24, 0);
  const dueMap = new Map(tasks.map((t) => [t.id, t.dueAt]));

  // A subtask is a line item of its parent, not a task in its own right: it
  // hangs under the parent's row instead of landing in whichever section its
  // (usually absent) due date puts it in. One whose parent is out of view stays
  // a row of its own — better a row without its group than work that vanishes.
  const visibleIds = new Set(tasks.map((t) => t.id));
  const parents = tasks.filter(
    (t) => !t.parentTaskId || !visibleIds.has(t.parentTaskId)
  );

  const subtasksByParent = new Map<string, SubtaskRowData[]>();
  for (const t of tasks) {
    if (!t.parentTaskId || !visibleIds.has(t.parentTaskId)) continue;
    const list = subtasksByParent.get(t.parentTaskId) ?? [];
    list.push({ id: t.id, title: t.title, done: t.status === "DONE" });
    subtasksByParent.set(t.parentTaskId, list);
  }

  // The page's own sort is by status and priority, which for a set of children
  // reads as shuffled — they belong in the order they were written.
  const positionOf = new Map(tasks.map((t) => [t.id, t.position]));
  const createdOf = new Map(tasks.map((t) => [t.id, t.createdAt.getTime()]));
  for (const list of subtasksByParent.values()) {
    list.sort(
      (a, b) =>
        (positionOf.get(a.id) ?? 0) - (positionOf.get(b.id) ?? 0) ||
        (createdOf.get(a.id) ?? 0) - (createdOf.get(b.id) ?? 0)
    );
  }

  const rows: TaskRowData[] = parents.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    status: t.status,
    priority: t.priority,
    dueAtInput: toLocalInput(t.dueAt),
    dueAtLabel: formatIST(t.dueAt),
    doneAtLabel: formatIST(t.completedAt),
    estimatedMinutes: t.estimatedMinutes ? String(t.estimatedMinutes) : "",
    overdue: !!t.dueAt && t.dueAt < now,
    assignees: t.assignments.map((a) => a.user.name ?? "").filter(Boolean),
    labels: t.labels.map((tl) => tl.label),
    subtasks: subtasksByParent.get(t.id) ?? [],
  }));

  const open = rows.filter(
    (r) => r.status !== "DONE" && r.status !== "CANCELLED"
  );
  const done = rows.filter((r) => r.status === "DONE");
  const overdue = open.filter((r) => r.overdue);
  const today = open.filter((r) => {
    if (r.overdue) return false;
    const due = dueMap.get(r.id);
    return !!due && due < endOfToday;
  });
  const later = open.filter(
    (r) => !r.overdue && r.dueAtLabel !== null && !today.includes(r)
  );
  const undated = open.filter((r) => r.dueAtLabel === null);

  // Focus mode's list: what today is actually asking for. Overdue leads, since
  // a task that slipped is today's problem too.
  const focusTasks = [...overdue, ...today];
  // Parents only, like the list above it — otherwise the meter counts progress
  // against tasks that are no longer rows of their own.
  const doneToday = parents.filter(
    (t) =>
      t.status === "DONE" &&
      !!t.completedAt &&
      t.completedAt >= startOfToday &&
      t.completedAt < endOfToday
  ).length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <FocusZone
        todayTasks={focusTasks}
        overdueCount={overdue.length}
        doneToday={doneToday}
        dateLabel={
          formatIST(now, {
            weekday: "long",
            day: "numeric",
            month: "long",
          }) ?? ""
        }
        openCount={open.length}
        doneCount={done.length}
      >
        {ctx.permissions.has("ai.use") ? (
          <div className="flex flex-col gap-2">
            <SmartComposer
              members={members}
              currentUserId={userId}
              labels={labelRows}
              storageReady={storageReady}
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
                  storageReady={storageReady}
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
            storageReady={storageReady}
          />
        )}

        {rows.length === 0 && (
          <p className="mt-10 text-center text-[13px] text-faint">
            No tasks yet. Describe one above in plain language.
          </p>
        )}

        <Section title="Overdue" tasks={overdue} />
        <Section title="Today" tasks={today} />
        <Section title="Upcoming" tasks={later} />
        <Section title="No date" tasks={undated} />
        <Section title="Done" tasks={done} />
      </FocusZone>
    </div>
  );
}