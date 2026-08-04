"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/rbac/guard";
import { fromLocalInput } from "@/lib/dates";
import { APP_CONFIG } from "@/config/app";
import {
  buildRRule,
  firstOccurrence,
  nextOccurrence,
  type RecurrenceInput,
} from "@/server/services/recurring";

function refresh() {
  revalidatePath("/settings");
  revalidatePath("/tasks");
}

export type RecurringInput = {
  title: string;
  description: string;
  priority: string;
  estimatedMinutes: string;
  /** datetime-local — the first run and the time of day every run fires at. */
  startsAt: string;
  endsAt: string;
  assigneeIds: string[];
  labelIds: string[];
  recurrence: RecurrenceInput;
};

export async function createRecurringTask(input: RecurringInput) {
  const ctx = await requirePermission("task.create");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const title = input.title.trim();
  if (!title) return { ok: false as const, error: "Give the task a title" };
  if (title.length > 200) {
    return { ok: false as const, error: "That title is too long" };
  }

  const startsAt = fromLocalInput(input.startsAt);
  if (!startsAt) return { ok: false as const, error: "Pick a start date and time" };

  const endsAt = input.endsAt ? fromLocalInput(input.endsAt) : null;
  if (endsAt && endsAt <= startsAt) {
    return { ok: false as const, error: "The end date has to come after the start" };
  }

  if (
    input.recurrence.freq === "WEEKLY" &&
    input.recurrence.byWeekday.length === 0
  ) {
    return { ok: false as const, error: "Pick at least one day of the week" };
  }

  const rrule = buildRRule(input.recurrence);

  const nextRunAt = firstOccurrence(rrule, startsAt, endsAt);
  if (!nextRunAt) {
    return {
      ok: false as const,
      error: "That schedule never fires — widen the date range",
    };
  }

  const members = await prisma.organizationMember.findMany({
    where: {
      organizationId: orgId,
      userId: {
        in: input.assigneeIds.length > 0 ? input.assigneeIds : [userId],
      },
      status: "ACTIVE",
    },
    select: { userId: true },
  });

  const assigneeIds = members.map((m) => m.userId);
  if (assigneeIds.length === 0) assigneeIds.push(userId);

  const labels = await prisma.label.findMany({
    where: { organizationId: orgId, id: { in: input.labelIds } },
    select: { id: true },
  });

  const estimate = input.estimatedMinutes
    ? Number(input.estimatedMinutes)
    : null;

  await prisma.recurringTask.create({
    data: {
      organizationId: orgId,
      ownerId: userId,
      assigneeId: assigneeIds[0],
      title,
      description: input.description.trim() || null,
      rrule,
      timezone: APP_CONFIG.timezone,
      startsAt,
      endsAt,
      nextRunAt,
      template: {
        description: input.description.trim() || null,
        priority: input.priority,
        estimatedMinutes:
          estimate !== null && Number.isFinite(estimate) ? estimate : null,
        assigneeIds,
        labelIds: labels.map((l) => l.id),
      },
    },
  });

  refresh();
  return { ok: true as const };
}

export async function setRecurringActive(id: string, isActive: boolean) {
  const ctx = await requirePermission("task.create");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const recurring = await prisma.recurringTask.findFirst({
    where: { id, organizationId: orgId, deletedAt: null },
  });
  if (!recurring) return { ok: false as const, error: "Not found" };

  const allowed =
    recurring.ownerId === userId || ctx.permissions.has("task.edit_any");
  if (!allowed) return { ok: false as const, error: "Not allowed" };

  // Resuming a paused series shouldn't fire every run it missed.
  const nextRunAt = isActive
    ? nextOccurrence(
        recurring.rrule,
        recurring.startsAt,
        new Date(),
        recurring.endsAt
      )
    : recurring.nextRunAt;

  if (isActive && !nextRunAt) {
    return { ok: false as const, error: "This series has no runs left" };
  }

  await prisma.recurringTask.update({
    where: { id },
    data: { isActive, nextRunAt },
  });

  refresh();
  return { ok: true as const };
}

export async function deleteRecurringTask(id: string) {
  const ctx = await requirePermission("task.create");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const recurring = await prisma.recurringTask.findFirst({
    where: { id, organizationId: orgId, deletedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!recurring) return { ok: false as const, error: "Not found" };

  const allowed =
    recurring.ownerId === userId || ctx.permissions.has("task.edit_any");
  if (!allowed) return { ok: false as const, error: "Not allowed" };

  await prisma.recurringTask.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });

  refresh();
  return { ok: true as const };
}
