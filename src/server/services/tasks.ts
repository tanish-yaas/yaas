import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

const PRIORITY_WEIGHT: Record<string, number> = {
  LOW: 5,
  MEDIUM: 15,
  HIGH: 30,
  URGENT: 45,
};

export function computePriorityScore(
  priority: string,
  dueAt: Date | null
): number {
  let score = PRIORITY_WEIGHT[priority] ?? 15;

  if (dueAt) {
    const hours = (dueAt.getTime() - Date.now()) / 3_600_000;
    if (hours < 0) score += 40;
    else if (hours < 24) score += 30;
    else if (hours < 72) score += 20;
    else if (hours < 168) score += 10;
  }

  return Math.round(score * 10) / 10;
}

export async function buildTaskScope(
  orgId: string,
  userId: string,
  permissions: Set<string>
): Promise<Prisma.TaskWhereInput> {
  const base: Prisma.TaskWhereInput = {
    organizationId: orgId,
    deletedAt: null,
  };

  if (permissions.has("task.view_any")) return base;

  const or: Prisma.TaskWhereInput[] = [
    { createdById: userId },
    { assignments: { some: { userId } } },
  ];

  if (permissions.has("task.view_team")) {
    const teams = await prisma.teamMember.findMany({
      where: { userId, organizationId: orgId },
      select: { teamId: true },
    });
    if (teams.length > 0) {
      or.push({ teamId: { in: teams.map((t) => t.teamId) } });
    }
  }

  return { ...base, OR: or };
}

export async function canMutateTask(
  taskId: string,
  orgId: string,
  userId: string,
  permissions: Set<string>
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: orgId, deletedAt: null },
    include: { assignments: { select: { userId: true } } },
  });

  if (!task) return null;
  if (permissions.has("task.edit_any")) return task;

  const isOwn =
    task.createdById === userId ||
    task.assignments.some((a) => a.userId === userId);

  return isOwn && permissions.has("task.edit_own") ? task : null;
}