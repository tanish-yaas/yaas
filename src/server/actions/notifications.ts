"use server";

import { prisma } from "@/lib/prisma";
import { requireContext, revalidateWorkspace } from "@/server/rbac/guard";
import { getNotifications, getUnreadCount } from "@/server/services/notifications";

export async function markRead(notificationId: string) {
  const ctx = await requireContext();

  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      organizationId: ctx.membership!.organizationId,
      userId: ctx.session.user.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  revalidateWorkspace("/notifications", "/");
  return { ok: true as const };
}

export async function markAllRead() {
  const ctx = await requireContext();

  const { count } = await prisma.notification.updateMany({
    where: {
      organizationId: ctx.membership!.organizationId,
      userId: ctx.session.user.id,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  revalidateWorkspace("/notifications", "/");
  return { ok: true as const, count };
}

export async function archiveNotification(notificationId: string) {
  const ctx = await requireContext();

  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      organizationId: ctx.membership!.organizationId,
      userId: ctx.session.user.id,
    },
    data: { archivedAt: new Date(), readAt: new Date() },
  });

  revalidateWorkspace("/notifications", "/");
  return { ok: true as const };
}
/** The bell's list, read when it opens rather than on every navigation. */
export async function loadNotifications() {
  const ctx = await requireContext();
  const orgId = ctx.membership.organizationId;
  const userId = ctx.session.user.id;

  const [items, unread] = await Promise.all([
    getNotifications(orgId, userId, { limit: 30 }),
    getUnreadCount(orgId, userId),
  ]);

  return { items, unread };
}

/** Polled while the tab is visible, so the badge moves without a reload. */
export async function unreadNotificationCount() {
  const ctx = await requireContext();
  return getUnreadCount(ctx.membership.organizationId, ctx.session.user.id);
}

/** Clears everything already read off the list. Soft, like every delete. */
export async function archiveRead() {
  const ctx = await requireContext();

  const { count } = await prisma.notification.updateMany({
    where: {
      organizationId: ctx.membership.organizationId,
      userId: ctx.session.user.id,
      readAt: { not: null },
      archivedAt: null,
    },
    data: { archivedAt: new Date() },
  });

  revalidateWorkspace("/notifications", "/");
  return { ok: true as const, count };
}
