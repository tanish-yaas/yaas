import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import {
  getUnreadCount,
  getRecentNotifications,
} from "@/server/services/notifications";
import { AppShell } from "@/components/layout/app-shell";
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
    <AppShell
      orgName={ctx.membership.organization.name}
      canApprove={canApprove}
      pendingCount={pendingCount}
      topbar={
        <Topbar
          displayName={ctx.profile.displayName ?? "You"}
          roleName={ctx.membership.role.name}
          image={ctx.session.user.image}
          unreadCount={unreadCount}
          notifications={notifications}
        />
      }
    >
      {children}
    </AppShell>
  );
}