"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireContext } from "@/server/rbac/guard";
import { computeNextSendAt } from "@/server/services/reminders";
import { avatarKeyOf } from "@/lib/avatars";
import { TIMEZONES } from "@/lib/timezones";

export async function updateTimezone(timezone: string) {
  const ctx = await requireContext();
  const userId = ctx.session.user.id;

  if (!TIMEZONES.some((t) => t.value === timezone)) {
    return { ok: false as const, error: "Unknown timezone" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.profile.update({
      where: { userId },
      data: { timezone },
    });

    const calendars = await tx.calendar.findMany({
      where: { ownerId: userId, type: "PERSONAL" },
      select: { id: true },
    });
    if (calendars.length > 0) {
      await tx.calendar.updateMany({
        where: { id: { in: calendars.map((c) => c.id) } },
        data: { timezone },
      });
    }

    const schedules = await tx.reminderSchedule.findMany({ where: { userId } });
    for (const s of schedules) {
      await tx.reminderSchedule.update({
        where: { id: s.id },
        data: {
          timezone,
          nextSendAt: s.isActive
            ? computeNextSendAt(s.timeOfDay, timezone, s.daysOfWeek)
            : null,
        },
      });
    }
  });

  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true as const };
}

const MAX_BIO = 280;

export async function updateProfile(input: {
  displayName: string;
  jobTitle: string;
  bio: string;
  /** "avatar:<key>" for a built-in, or "" to fall back to the sign-in photo. */
  avatarUrl: string;
}) {
  const ctx = await requireContext();
  const userId = ctx.session.user.id;

  const displayName = input.displayName.trim();
  if (displayName.length === 0) {
    return { ok: false as const, error: "Name can't be empty" };
  }
  if (displayName.length > 80) {
    return { ok: false as const, error: "Name is too long" };
  }

  const bio = input.bio.trim();
  if (bio.length > MAX_BIO) {
    return { ok: false as const, error: `Bio is limited to ${MAX_BIO} characters` };
  }

  // Only the built-in keys are accepted. avatarUrl is rendered as an <img> src
  // when it is not one of them, so taking a caller-supplied string here would
  // let anyone point another member's avatar wherever they liked.
  const avatar = input.avatarUrl.trim();
  if (avatar !== "" && !avatarKeyOf(avatar)) {
    return { ok: false as const, error: "Unknown avatar" };
  }

  await prisma.profile.update({
    where: { userId },
    data: {
      displayName,
      jobTitle: input.jobTitle.trim() || null,
      bio: bio || null,
      avatarUrl: avatar || null,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath(`/people/${userId}`);
  return { ok: true as const };
}

export async function updateWorkingHours(input: {
  workingHoursStart: number;
  workingHoursEnd: number;
  workingDays: number[];
}) {
  const ctx = await requireContext();
  const userId = ctx.session.user.id;

  const start = Math.min(Math.max(input.workingHoursStart, 0), 23);
  const end = Math.min(Math.max(input.workingHoursEnd, 1), 24);
  if (end <= start) return { ok: false as const, error: "End must be after start" };

  const days = input.workingDays.filter((d) => d >= 0 && d <= 6);
  if (days.length === 0) return { ok: false as const, error: "Pick at least one day" };

  await prisma.profile.update({
    where: { userId },
    data: {
      workingHoursStart: start,
      workingHoursEnd: end,
      workingDays: days,
    },
  });

  revalidatePath("/settings");
  return { ok: true as const };
}