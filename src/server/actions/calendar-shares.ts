"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/rbac/guard";

type AccessLevel = "VIEW" | "COMMENT" | "EDIT" | "FULL_ACCESS";

const LEVELS: AccessLevel[] = ["VIEW", "COMMENT", "EDIT", "FULL_ACCESS"];

/** Only the owner (or an org-wide calendar admin) may hand out access. */
async function requireShareableCalendar(calendarId: string) {
  const ctx = await requirePermission("calendar.share");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const calendar = await prisma.calendar.findFirst({
    where: { id: calendarId, organizationId: orgId, deletedAt: null },
    select: { id: true, ownerId: true, name: true },
  });

  if (!calendar) return null;

  const allowed =
    calendar.ownerId === userId || ctx.permissions.has("calendar.edit_any");

  return allowed ? { ctx, orgId, userId, calendar } : null;
}

export async function shareCalendar(
  calendarId: string,
  targetUserId: string,
  accessLevel: string
) {
  const context = await requireShareableCalendar(calendarId);
  if (!context) return { ok: false as const, error: "Not allowed" };

  const { orgId, userId, calendar } = context;

  if (!LEVELS.includes(accessLevel as AccessLevel)) {
    return { ok: false as const, error: "Unknown access level" };
  }
  if (targetUserId === calendar.ownerId) {
    return { ok: false as const, error: "They already own this calendar" };
  }

  const member = await prisma.organizationMember.findFirst({
    where: { organizationId: orgId, userId: targetUserId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!member) return { ok: false as const, error: "Not an active member" };

  await prisma.calendarShare.upsert({
    where: { calendarId_userId: { calendarId, userId: targetUserId } },
    update: { accessLevel: accessLevel as AccessLevel, grantedById: userId },
    create: {
      organizationId: orgId,
      calendarId,
      userId: targetUserId,
      accessLevel: accessLevel as AccessLevel,
      grantedById: userId,
    },
  });

  await prisma.activityLog.create({
    data: {
      organizationId: orgId,
      userId,
      action: "calendar.shared",
      entityType: "Calendar",
      entityId: calendarId,
      metadata: { targetUserId, accessLevel, name: calendar.name },
    },
  });

  revalidatePath("/calendar");
  return { ok: true as const };
}

export async function revokeCalendarShare(shareId: string) {
  const ctx = await requirePermission("calendar.share");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const share = await prisma.calendarShare.findFirst({
    where: { id: shareId, organizationId: orgId },
    include: { calendar: { select: { ownerId: true } } },
  });
  if (!share) return { ok: false as const, error: "Share not found" };

  const allowed =
    share.calendar.ownerId === userId ||
    ctx.permissions.has("calendar.edit_any");
  if (!allowed) return { ok: false as const, error: "Not allowed" };

  await prisma.calendarShare.delete({ where: { id: shareId } });

  revalidatePath("/calendar");
  return { ok: true as const };
}
