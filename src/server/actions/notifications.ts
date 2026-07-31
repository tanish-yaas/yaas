"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireContext } from "@/server/rbac/guard";

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

  revalidatePath("/notifications");
  revalidatePath("/");
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

  revalidatePath("/notifications");
  revalidatePath("/");
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

  revalidatePath("/notifications");
  revalidatePath("/");
  return { ok: true as const };
}