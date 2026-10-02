import { getCurrentContext } from "@/server/auth/session";
import { getNotifications, getUnreadCount } from "@/server/services/notifications";
import { istTodayKey } from "@/lib/dates";
import { NotificationCenter } from "@/components/notifications/notification-center";

export const metadata = { title: "Notifications" };

const LIMIT = 100;

export default async function NotificationsPage() {
  const ctx = await getCurrentContext();
  if (!ctx?.membership) return null;

  const orgId = ctx.membership.organizationId;
  const userId = ctx.session.user.id;

  const [items, unread] = await Promise.all([
    getNotifications(orgId, userId, { limit: LIMIT }),
    getUnreadCount(orgId, userId),
  ]);

  return (
    <NotificationCenter
      items={items}
      unread={unread}
      todayKey={istTodayKey()}
      limit={LIMIT}
    />
  );
}
