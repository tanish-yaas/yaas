import { getCurrentContext } from "@/server/auth/session";
import { prisma } from "@/lib/prisma";
import { relativeTime } from "@/lib/relative-time";
import { NotificationList } from "@/components/notifications/notification-list";
import { ActivityFeed } from "@/components/notifications/activity-feed";

export default async function NotificationsPage() {
  const ctx = await getCurrentContext();
  if (!ctx?.membership) return null;

  const orgId = ctx.membership.organizationId;
  const userId = ctx.session.user.id;

  const [notifications, activity] = await Promise.all([
    prisma.notification.findMany({
      where: { organizationId: orgId, userId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.activityLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { user: { select: { name: true, image: true } } },
    }),
  ]);

  const rows = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    taskId: n.taskId,
    when: relativeTime(n.createdAt),
    unread: !n.readAt,
  }));

  const feed = activity.map((a) => ({
    id: a.id,
    action: a.action,
    entityType: a.entityType,
    actorName: a.user?.name ?? "Someone",
    actorImage: a.user?.image ?? null,
    metadata: (a.metadata as { title?: string } | null) ?? null,
    when: relativeTime(a.createdAt),
  }));

  const unread = rows.filter((r) => r.unread).length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {unread > 0 ? `${unread} unread` : "All caught up"}
        </p>
      </header>

      <NotificationList notifications={rows} hasUnread={unread > 0} />

      <section className="mt-10">
        <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Workspace activity
        </h2>
        <ActivityFeed items={feed} />
      </section>
    </div>
  );
}