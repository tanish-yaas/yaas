import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import { istTodayKey } from "@/lib/dates";
import { AppShell } from "@/components/layout/app-shell";
import {
  TopbarData,
  TopbarFallback,
} from "@/components/layout/topbar-data";

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

  // Only the sidebar's pending badge is awaited here — it is one count, and it
  // decides what the nav renders. Everything the topbar needs streams in behind
  // Suspense so the shell and the route's loading.tsx paint immediately.
  const pendingCount = canApprove
    ? await prisma.organizationMember.count({
        where: { organizationId: orgId, status: "PENDING" },
      })
    : 0;

  return (
    <AppShell
      orgName={ctx.membership.organization.name}
      canApprove={canApprove}
      pendingCount={pendingCount}
      todayKey={istTodayKey()}
      canPush={ctx.permissions.has("ai.use")}
      topbar={
        <Suspense fallback={<TopbarFallback />}>
          <TopbarData
            orgId={orgId}
            userId={userId}
            displayName={ctx.profile.displayName ?? "You"}
            roleName={ctx.membership.role.name}
            image={ctx.session.user.image}
            avatarUrl={ctx.profile.avatarUrl}
          />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}