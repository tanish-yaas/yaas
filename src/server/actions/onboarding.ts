"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { onboardingSchema } from "@/lib/validators/onboarding";
import { ensureWorkspaceMemberSetup } from "@/server/workspace/provision";
import { wsPath } from "@/server/workspace/paths";

export async function completeOnboarding(formData: FormData) {
  // Deliberately not requireContext(). This form lives at /onboarding, above
  // /w, so there is no workspace on the request for the guard to resolve and
  // it would refuse every submission. What it sets — a name, working hours, a
  // WhatsApp number — belongs to the person and is the same in every
  // workspace, so an account is the only thing it needs.
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  // Which workspace sent them here, carried through the form. Used to furnish
  // that one workspace and to land them back in it.
  const next = String(formData.get("next") ?? "").trim();

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
    redirect(
      `/onboarding?error=${encodeURIComponent(message)}${next ? `&next=${encodeURIComponent(next)}` : ""}`
    );
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
        `/onboarding?error=${encodeURIComponent("That WhatsApp number is already linked to another account")}${next ? `&next=${encodeURIComponent(next)}` : ""}`
      );
    }
  }

  await prisma.profile.upsert({
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

  // Verified against live membership: `next` came from the form and is a
  // handle anyone could type.
  const membership = next
    ? await prisma.organizationMember.findFirst({
        where: {
          userId,
          status: "ACTIVE",
          organization: { slug: next, deletedAt: null },
        },
        select: { organizationId: true, organization: { select: { slug: true } } },
      })
    : null;

  if (membership) {
    await ensureWorkspaceMemberSetup(userId, membership.organizationId);
    redirect(wsPath(membership.organization.slug));
  }

  redirect("/");
}