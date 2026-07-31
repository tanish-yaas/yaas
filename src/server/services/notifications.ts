import { prisma } from "@/lib/prisma";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  taskId: string | null;
  eventId: string | null;
  createdAt: string;
  readAt: string | null;
};

export async function getUnreadCount(orgId: string, userId: string) {
  return prisma.notification.count({
    where: {
      organizationId: orgId,
      userId,
      readAt: null,
      archivedAt: null,
    },
  });
}

export async function getRecentNotifications(
  orgId: string,
  userId: string,
  limit = 20
): Promise<NotificationRow[]> {
  const rows = await prisma.notification.findMany({
    where: { organizationId: orgId, userId, archivedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    taskId: n.taskId,
    eventId: n.eventId,
    createdAt: n.createdAt.toISOString(),
    readAt: n.readAt?.toISOString() ?? null,
  }));
}