"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireContext } from "@/server/rbac/guard";
import { computeNextSendAt } from "@/server/services/reminders";

export async function updateReminderSchedule(
  scheduleId: string,
  input: { timeOfDay: string; isActive: boolean; channel: string }
) {
  const ctx = await requireContext();
  const userId = ctx.session.user.id;

  const schedule = await prisma.reminderSchedule.findFirst({
    where: { id: scheduleId, userId },
  });
  if (!schedule) return { ok: false as const, error: "Not found" };

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.timeOfDay)) {
    return { ok: false as const, error: "Invalid time" };
  }

  const timezone = ctx.profile?.timezone ?? schedule.timezone;

  const next = input.isActive
    ? computeNextSendAt(input.timeOfDay, timezone, schedule.daysOfWeek)
    : null;

  await prisma.reminderSchedule.update({
    where: { id: scheduleId },
    data: {
      timeOfDay: input.timeOfDay,
      isActive: input.isActive,
      channel: input.channel as "IN_APP" | "WHATSAPP",
      timezone,
      nextSendAt: next,
    },
  });

  revalidatePath("/settings");
  return { ok: true as const };
}

export async function ensureWeeklySchedule() {
  const ctx = await requireContext();
  const userId = ctx.session.user.id;
  const orgId = ctx.membership!.organizationId;
  const timezone = ctx.profile?.timezone ?? "UTC";

  const existing = await prisma.reminderSchedule.findFirst({
    where: { userId, type: "WEEKLY_REVIEW" },
  });
  if (existing) return { ok: true as const };

  await prisma.reminderSchedule.create({
    data: {
      organizationId: orgId,
      userId,
      type: "WEEKLY_REVIEW",
      channel: "IN_APP",
      timeOfDay: "17:00",
      timezone,
      daysOfWeek: [5],
      nextSendAt: computeNextSendAt("17:00", timezone, [5]),
    },
  });

  revalidatePath("/settings");
  return { ok: true as const };
}