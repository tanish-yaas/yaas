"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireContext } from "@/server/rbac/guard";
import { onboardingSchema } from "@/lib/validators/onboarding";

export async function completeOnboarding(formData: FormData) {
  const ctx = await requireContext();
  const userId = ctx.session.user.id;
  const orgId = ctx.membership!.organizationId;

  const parsed = onboardingSchema.safeParse({
    displayName: formData.get("displayName") ?? "",
    jobTitle: formData.get("jobTitle") ?? "",
    whatsappNumber: formData.get("whatsappNumber") ?? "",
    timezone: formData.get("timezone") ?? "",
    workingHoursStart: formData.get("workingHoursStart") ?? 9,
    workingHoursEnd: formData.get("workingHoursEnd") ?? 17,
    workingDays: formData.getAll("workingDays"),
    whatsappOptIn: formData.get("whatsappOptIn") === "on",
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }

  const d = parsed.data;
  const whatsappNumber = d.whatsappNumber ? d.whatsappNumber : null;

  if (whatsappNumber) {
    const taken = await prisma.profile.findFirst({
      where: { whatsappNumber, userId: { not: userId } },
      select: { id: true },
    });
    if (taken) {
      redirect(
        `/onboarding?error=${encodeURIComponent("That WhatsApp number is already linked to another account")}`
      );
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.profile.upsert({
      where: { userId },
      update: {
        displayName: d.displayName,
        jobTitle: d.jobTitle || null,
        whatsappNumber,
        whatsappOptIn: d.whatsappOptIn,
        timezone: d.timezone,
        workingHoursStart: d.workingHoursStart,
        workingHoursEnd: d.workingHoursEnd,
        workingDays: d.workingDays,
      },
      create: {
        userId,
        displayName: d.displayName,
        jobTitle: d.jobTitle || null,
        whatsappNumber,
        whatsappOptIn: d.whatsappOptIn,
        timezone: d.timezone,
        workingHoursStart: d.workingHoursStart,
        workingHoursEnd: d.workingHoursEnd,
        workingDays: d.workingDays,
      },
    });

    const existingCalendar = await tx.calendar.findFirst({
      where: { ownerId: userId, organizationId: orgId, type: "PERSONAL" },
      select: { id: true },
    });

    if (!existingCalendar) {
      await tx.calendar.create({
        data: {
          organizationId: orgId,
          ownerId: userId,
          name: `${d.displayName}'s Calendar`,
          type: "PERSONAL",
          timezone: d.timezone,
          isDefault: true,
          color: "#7C5CFF",
        },
      });
    }

    await tx.reminderSchedule.createMany({
      data: [
        {
          organizationId: orgId,
          userId,
          type: "MORNING_DIGEST",
          channel: "IN_APP",
          timeOfDay: "08:00",
          timezone: d.timezone,
          daysOfWeek: d.workingDays,
        },
        {
          organizationId: orgId,
          userId,
          type: "EVENING_REVIEW",
          channel: "IN_APP",
          timeOfDay: "18:00",
          timezone: d.timezone,
          daysOfWeek: d.workingDays,
        },
      ],
      skipDuplicates: true,
    });
  });

  redirect("/");
}