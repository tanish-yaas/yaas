import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import {
  getUnreadCount,
  getRecentNotifications,
} from "@/server/services/notifications";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentContext();

  if (!ctx) redirect("/login");
  if (!ctx.membership || ctx.membership.status === "PENDING") redirect("/pending");
  if (ctx.membership.status === "DEACTIVATED") redirect("/login");
  if (!ctx.profile) redirect("/onboarding");

  const orgId = ctx.membership.organizationId;
  const userId = ctx.session.user.id;
  const canApprove = ctx.permissions.has("member.approve");

  const [pendingCount, unreadCount, notifications] = await Promise.all([
    canApprove
      ? prisma.organizationMember.count({
          where: { organizationId: orgId, status: "PENDING" },
        })
      : Promise.resolve(0),
    getUnreadCount(orgId, userId),
    getRecentNotifications(orgId, userId, 15),
  ]);

  return (
    <div className="aurora flex h-screen overflow-hidden">
      <Sidebar
        orgName={ctx.membership.organization.name}
        canApprove={canApprove}
        pendingCount={pendingCount}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          displayName={ctx.profile.displayName ?? "You"}
          roleName={ctx.membership.role.name}
          image={ctx.session.user.image}
          unreadCount={unreadCount}
          notifications={notifications}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}