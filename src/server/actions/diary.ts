"use server";

import { prisma } from "@/lib/prisma";
import { requireContext, requirePermission, checkRate } from "@/server/rbac/guard";
import { LIMITS } from "@/lib/rate-limit";
import { parseTaskInput } from "@/server/services/ai-parser";
import { applyParsedTask } from "@/server/actions/ai-tasks";
import { toLocalInput, formatIST } from "@/lib/dates";
import {
  dayKeySchema,
  diaryPointsSchema,
  type DiaryPoint,
} from "@/lib/validators/diary";

/**
 * A page holds nothing worth keeping once every point is blank and none of them
 * became a task. Those rows are soft-deleted rather than written, so paging back
 * through the diary skips days you opened and thought better of.
 */
function isEmptyPage(points: DiaryPoint[]) {
  return points.every((p) => !p.text.trim() && !p.taskId);
}

function readPoints(value: unknown): DiaryPoint[] {
  const parsed = diaryPointsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export async function loadDiaryPage(rawDayKey: string) {
  const ctx = await requireContext();

  const dayKey = dayKeySchema.safeParse(rawDayKey);
  if (!dayKey.success) return { ok: false as const, error: "That isn't a day" };

  const entry = await prisma.diaryEntry.findFirst({
    where: {
      organizationId: ctx.membership!.organizationId,
      userId: ctx.session.user.id,
      dayKey: dayKey.data,
      deletedAt: null,
    },
    select: { points: true },
  });

  return {
    ok: true as const,
    dayKey: dayKey.data,
    points: entry ? readPoints(entry.points) : [],
  };
}

/** Which days in a range have a page, so the date picker can mark them. */
export async function listDiaryDays(rawFrom: string, rawTo: string) {
  const ctx = await requireContext();

  const from = dayKeySchema.safeParse(rawFrom);
  const to = dayKeySchema.safeParse(rawTo);
  if (!from.success || !to.success) {
    return { ok: false as const, error: "That isn't a range" };
  }

  // Day keys are zero-padded, so string ordering is date ordering.
  const entries = await prisma.diaryEntry.findMany({
    where: {
      organizationId: ctx.membership!.organizationId,
      userId: ctx.session.user.id,
      deletedAt: null,
      dayKey: { gte: from.data, lte: to.data },
    },
    select: { dayKey: true },
    take: 400,
  });

  return { ok: true as const, days: entries.map((e) => e.dayKey) };
}

export async function saveDiaryPage(rawDayKey: string, rawPoints: unknown) {
  const ctx = await requireContext();
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const rate = checkRate(
    userId,
    "diary-save",
    LIMITS.diarySave.limit,
    LIMITS.diarySave.window
  );
  if (!rate.allowed) {
    return {
      ok: false as const,
      error: `Too many saves — try again in ${rate.retryAfterSeconds}s.`,
    };
  }

  const dayKey = dayKeySchema.safeParse(rawDayKey);
  if (!dayKey.success) return { ok: false as const, error: "That isn't a day" };

  const points = diaryPointsSchema.safeParse(rawPoints);
  if (!points.success) {
    return { ok: false as const, error: "That page is too long to save" };
  }

  const where = { organizationId: orgId, userId, dayKey: dayKey.data };

  if (isEmptyPage(points.data)) {
    await prisma.diaryEntry.updateMany({
      where: { ...where, deletedAt: null },
      data: { deletedAt: new Date(), points: [] },
    });
    return { ok: true as const, savedAt: Date.now() };
  }

  // The unique key is (org, user, day), so an upsert is the whole story — and
  // it revives a page that was emptied earlier and is being written in again.
  await prisma.diaryEntry.upsert({
    where: { organizationId_userId_dayKey: where },
    create: { ...where, points: points.data },
    update: { points: points.data, deletedAt: null },
  });

  return { ok: true as const, savedAt: Date.now() };
}

/**
 * Turn one bullet into a real task: the parser reads it, the existing apply
 * path writes it, and the point remembers which task it became.
 *
 * The AI still only proposes — this runs because someone pressed push on a line
 * they wrote themselves, and every write goes through applyParsedTask.
 */
export async function pushDiaryPoint(rawDayKey: string, pointId: string) {
  const ctx = await requirePermission("ai.use");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const rate = checkRate(
    userId,
    "ai-parse",
    LIMITS.aiParse.limit,
    LIMITS.aiParse.window
  );
  if (!rate.allowed) {
    return {
      ok: false as const,
      error: `Slow down a moment — try again in ${rate.retryAfterSeconds}s.`,
    };
  }

  const dayKey = dayKeySchema.safeParse(rawDayKey);
  if (!dayKey.success) return { ok: false as const, error: "That isn't a day" };

  const entry = await prisma.diaryEntry.findFirst({
    where: {
      organizationId: orgId,
      userId,
      dayKey: dayKey.data,
      deletedAt: null,
    },
    select: { id: true, points: true },
  });
  if (!entry) return { ok: false as const, error: "Save the page first" };

  const points = readPoints(entry.points);
  const point = points.find((p) => p.id === pointId);
  if (!point) return { ok: false as const, error: "That point is gone" };
  if (point.taskId) {
    return { ok: false as const, error: "That one is already a task" };
  }

  const text = point.text.trim();
  if (!text) return { ok: false as const, error: "Write the point first" };

  const parsed = await parseTaskInput({ rawInput: text, orgId, userId });
  if (!parsed.ok) return { ok: false as const, error: parsed.error };

  const draft = parsed.parsed;

  // The parser suggests label names; anything the workspace already has gets
  // attached, and inventing the rest is left to the composer where the user can
  // see what is being created.
  const suggested = draft.labels.map((l) => l.trim()).filter(Boolean);
  const labelIds =
    suggested.length > 0
      ? (
          await prisma.label.findMany({
            where: {
              organizationId: orgId,
              name: { in: suggested, mode: "insensitive" },
            },
            select: { id: true },
            take: 3,
          })
        ).map((l) => l.id)
      : [];

  const applied = await applyParsedTask(parsed.parsedTaskId, {
    title: draft.title,
    description: draft.description ?? "",
    priority: draft.priority,
    dueAt: draft.dueAt ? toLocalInput(new Date(draft.dueAt)) : "",
    estimatedMinutes: draft.estimatedMinutes
      ? String(draft.estimatedMinutes)
      : "",
    assigneeIds: [],
    subtasks: draft.subtasks,
    labelIds,
  });

  if (!applied.ok || !applied.taskId) {
    return {
      ok: false as const,
      error: applied.error ?? "That didn't save — try again",
    };
  }

  const stamped = points.map((p) =>
    p.id === pointId
      ? { ...p, taskId: applied.taskId!, taskTitle: draft.title }
      : p
  );

  await prisma.diaryEntry.update({
    where: { id: entry.id },
    data: { points: stamped },
  });

  return {
    ok: true as const,
    taskId: applied.taskId,
    title: draft.title,
    dueLabel: draft.dueAt ? formatIST(new Date(draft.dueAt)) : null,
    priority: draft.priority,
  };
}
