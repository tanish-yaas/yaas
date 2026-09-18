import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  getCurrentContext,
  getRequestWorkspaceSlug,
  listMemberships,
} from "@/server/auth/session";
import { istTodayKey } from "@/lib/dates";
import { AppShell } from "@/components/layout/app-shell";
import { TopbarData, TopbarFallback } from "@/components/layout/topbar-data";
import type {
  WorkspaceMenuData,
  WorkspaceOption,
} from "@/components/workspace/workspace-switcher";
import { wsPath } from "@/server/workspace/paths";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;

  // The route param is the authority; the proxy header is what Server Actions
  // read. They are the same string from the same URL, and if they ever are
  // not, actions on this page would write into the wrong workspace — so say so
  // here rather than let it through.
  const headerSlug = await getRequestWorkspaceSlug();

  if (headerSlug !== workspace) {
    // Both are read from the same URL, so they cannot disagree unless the
    // proxy stopped running. In development say which, because the fix is a
    // one-line matcher change; in production refuse to render, because the
    // alternative is a page whose links point at one workspace and whose data
    // came from another.
    if (process.env.NODE_ENV !== "production") {
      throw new Error(
        `Workspace mismatch: route says "${workspace}", proxy says "${headerSlug}". ` +
          `Check the matcher in src/proxy.ts.`
      );
    }
    notFound();
  }

  // Called bare, exactly as every page below does. Passing `workspace` here
  // would key React's cache differently from getCurrentContext() and run the
  // membership and profile queries twice on every request — the check above is
  // what makes the bare call safe.
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");

  // Not a member, or no such workspace: the same 404 either way. Telling a
  // stranger which handles exist is telling them who is on Nova.
  if (!ctx.membership) notFound();
  if (ctx.membership.status === "PENDING") redirect(`/pending?w=${workspace}`);
  if (ctx.membership.status === "DEACTIVATED") notFound();
  if (!ctx.profile) redirect(`/onboarding?next=${encodeURIComponent(workspace)}`);

  const orgId = ctx.membership.organizationId;
  const userId = ctx.session.user.id;
  const canApprove = ctx.permissions.has("member.approve");

  // Only what the sidebar renders is awaited here: the pending badge and the
  // workspace switcher at its top. Each is one narrow query, run side by side.
  // Everything the topbar needs streams in behind Suspense so the shell and
  // the route's loading.tsx paint immediately.
  const [pendingCount, memberships, settings] = await Promise.all([
    canApprove
      ? prisma.organizationMember.count({
          where: { organizationId: orgId, status: "PENDING" },
        })
      : Promise.resolve(0),
    listMemberships(userId),
    // Only feeds the switcher's "Default" line.
    prisma.userSettings.findUnique({
      where: { userId },
      select: { defaultOrganizationId: true },
    }),
  ]);

  // Workspaces you can open lead; ones you are still waiting on sit at the
  // bottom, where they read as a status rather than a destination.
  const workspaces: WorkspaceOption[] = memberships
    .slice()
    .sort((a, b) => Number(a.status === "PENDING") - Number(b.status === "PENDING"))
    .map((m) => ({
      id: m.organizationId,
      name: m.organization.name,
      slug: m.organization.slug,
      logoUrl: m.organization.logoUrl,
      roleName: m.role.name,
      pending: m.status === "PENDING",
      href:
        m.status === "PENDING"
          ? `/pending?w=${m.organization.slug}`
          : wsPath(m.organization.slug),
    }));

  // Built from the membership this request already resolved, not looked up in
  // the list: the list is for the menu, and this page is only rendering
  // because that membership exists.
  const workspaceMenu: WorkspaceMenuData = {
    current: {
      id: orgId,
      name: ctx.membership.organization.name,
      slug: workspace,
      logoUrl: ctx.membership.organization.logoUrl,
      roleName: ctx.membership.role.name,
      pending: false,
      href: wsPath(workspace),
    },
    workspaces,
    defaultWorkspaceId: settings?.defaultOrganizationId ?? null,
  };

  return (
    <AppShell
      workspaceSlug={workspace}
      workspaceMenu={workspaceMenu}
      canApprove={canApprove}
      pendingCount={pendingCount}
      todayKey={istTodayKey()}
      canPush={ctx.permissions.has("ai.use")}
      topbar={
        <Suspense fallback={<TopbarFallback />}>
          <TopbarData
            orgId={orgId}
            workspaceSlug={workspace}
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
