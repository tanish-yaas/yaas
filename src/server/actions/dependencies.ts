"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireContext, requirePermission } from "@/server/rbac/guard";
import { buildTaskScope, canMutateTask } from "@/server/services/tasks";

const MAX_DEPTH = 50;

function refresh() {
  revalidatePath("/tasks");
  revalidatePath("/");
}

/**
 * Would "task depends on blocker" close a loop? Walk the blocker's own
 * dependencies breadth-first; reaching the task means the edge is circular.
 */
async function wouldCycle(
  orgId: string,
  taskId: string,
  blockerId: string
): Promise<boolean> {
  if (taskId === blockerId) return true;

  const seen = new Set<string>([blockerId]);
  let frontier = [blockerId];

  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
    const edges = await prisma.taskDependency.findMany({
      where: {
        organizationId: orgId,
        type: "BLOCKS",
        taskId: { in: frontier },
      },
      select: { dependsOnTaskId: true },
    });

    const next: string[] = [];
    for (const edge of edges) {
      if (edge.dependsOnTaskId === taskId) return true;
      if (seen.has(edge.dependsOnTaskId)) continue;
      seen.add(edge.dependsOnTaskId);
      next.push(edge.dependsOnTaskId);
    }

    frontier = next;
  }

  return false;
}

/** direction "blocked-by": the other task blocks this one. "blocks": reverse. */
export async function addDependency(
  taskId: string,
  otherTaskId: string,
  direction: "blocked-by" | "blocks"
) {
  const ctx = await requirePermission("task.edit_own");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const task = await canMutateTask(taskId, orgId, userId, ctx.permissions);
  if (!task) return { ok: false as const, error: "Not allowed" };

  const scope = await buildTaskScope(orgId, userId, ctx.permissions);
  const other = await prisma.task.findFirst({
    where: { ...scope, id: otherTaskId },
    select: { id: true, title: true },
  });
  if (!other) return { ok: false as const, error: "That task isn't available" };

  const dependent = direction === "blocked-by" ? taskId : otherTaskId;
  const blocker = direction === "blocked-by" ? otherTaskId : taskId;

  if (dependent === blocker) {
    return { ok: false as const, error: "A task can't block itself" };
  }

  if (await wouldCycle(orgId, dependent, blocker)) {
    return {
      ok: false as const,
      error: `That would create a loop — "${other.title}" already waits on this task, directly or through another.`,
    };
  }

  const existing = await prisma.taskDependency.findFirst({
    where: {
      organizationId: orgId,
      taskId: dependent,
      dependsOnTaskId: blocker,
      type: "BLOCKS",
    },
    select: { id: true },
  });
  if (existing) return { ok: false as const, error: "That link already exists" };

  await prisma.taskDependency.create({
    data: {
      organizationId: orgId,
      taskId: dependent,
      dependsOnTaskId: blocker,
      type: "BLOCKS",
    },
  });

  refresh();
  return { ok: true as const };
}

export async function removeDependency(dependencyId: string) {
  const ctx = await requirePermission("task.edit_own");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const dependency = await prisma.taskDependency.findFirst({
    where: { id: dependencyId, organizationId: orgId },
    select: { id: true, taskId: true, dependsOnTaskId: true },
  });
  if (!dependency) return { ok: false as const, error: "Link not found" };

  // Either end of the link is enough to unlink it.
  const canEditDependent = await canMutateTask(
    dependency.taskId,
    orgId,
    userId,
    ctx.permissions
  );
  const canEditBlocker = canEditDependent
    ? null
    : await canMutateTask(
        dependency.dependsOnTaskId,
        orgId,
        userId,
        ctx.permissions
      );

  if (!canEditDependent && !canEditBlocker) {
    return { ok: false as const, error: "Not allowed" };
  }

  await prisma.taskDependency.delete({ where: { id: dependencyId } });

  refresh();
  return { ok: true as const };
}

/** Type-ahead for the dependency picker, scoped to what the user can see. */
export async function searchTasksForDependency(
  taskId: string,
  query: string
): Promise<{ id: string; title: string; status: string }[]> {
  const ctx = await requireContext();
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const term = query.trim();
  const scope = await buildTaskScope(orgId, userId, ctx.permissions);

  const linked = await prisma.taskDependency.findMany({
    where: {
      organizationId: orgId,
      OR: [{ taskId }, { dependsOnTaskId: taskId }],
    },
    select: { taskId: true, dependsOnTaskId: true },
  });

  const exclude = new Set<string>([taskId]);
  for (const link of linked) {
    exclude.add(link.taskId);
    exclude.add(link.dependsOnTaskId);
  }

  const tasks = await prisma.task.findMany({
    where: {
      ...scope,
      id: { notIn: [...exclude] },
      ...(term ? { title: { contains: term, mode: "insensitive" } } : {}),
    },
    orderBy: term ? { title: "asc" } : { createdAt: "desc" },
    take: 8,
    select: { id: true, title: true, status: true },
  });

  return tasks;
}
