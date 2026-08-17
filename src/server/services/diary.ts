import { prisma } from "@/lib/prisma";
import { formatIST } from "@/lib/dates";
import { diaryColorFor } from "@/lib/diary-color";
import { buildTaskScope } from "@/server/services/tasks";
import { diaryPointsSchema, type DiaryPoint } from "@/lib/validators/diary";

/** What a pushed point became, as it stands now rather than when it was pushed. */
export type DiaryTaskMeta = {
  id: string;
  title: string;
  dueLabel: string | null;
  status: string;
  done: boolean;
  overdue: boolean;
};

export type DiaryPageData = {
  dayKey: string;
  points: DiaryPoint[];
  color: string;
  tasks: DiaryTaskMeta[];
};

export function readDiaryPoints(value: unknown): DiaryPoint[] {
  const parsed = diaryPointsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/**
 * One diary page, with the live state of every task its points became.
 *
 * The task titles and due dates are read back rather than trusted from the
 * point — a task renamed or rescheduled after the push should read correctly on
 * the page that started it. The stored title stays as the fallback for a task
 * that has since been deleted.
 */
export async function getDiaryPage(
  orgId: string,
  userId: string,
  permissions: Set<string>,
  dayKey: string
): Promise<DiaryPageData> {
  const entry = await prisma.diaryEntry.findFirst({
    where: { organizationId: orgId, userId, dayKey, deletedAt: null },
    select: { points: true, color: true },
  });

  const points = entry ? readDiaryPoints(entry.points) : [];
  const taskIds = points
    .map((p) => p.taskId)
    .filter((id): id is string => !!id);

  let tasks: DiaryTaskMeta[] = [];

  if (taskIds.length > 0) {
    const scope = await buildTaskScope(orgId, userId, permissions);
    const rows = await prisma.task.findMany({
      where: { ...scope, id: { in: taskIds } },
      select: { id: true, title: true, status: true, dueAt: true },
    });

    const now = new Date();
    tasks = rows.map((t) => ({
      id: t.id,
      title: t.title,
      dueLabel: formatIST(t.dueAt),
      status: t.status,
      done: t.status === "DONE",
      overdue: !!t.dueAt && t.dueAt < now && t.status !== "DONE",
    }));
  }

  return {
    dayKey,
    points,
    color: entry?.color ?? diaryColorFor(dayKey),
    tasks,
  };
}
