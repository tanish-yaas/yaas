import { prisma } from "@/lib/prisma";
import { istTodayKey } from "@/lib/dates";
import {
  getRecentNotifications,
  getUnreadCount,
} from "@/server/services/notifications";
import { Topbar } from "@/components/layout/topbar";
import type { WorkspaceOption } from "@/components/workspace/workspace-switcher";
import type { SuggestionHintRow } from "@/components/layout/suggestion-hint";
import type { SuggestionPayload } from "@/server/services/intelligence";

/**
 * The topbar's data, split out of the layout so it can sit behind Suspense.
 *
 * These three queries used to be awaited in AppLayout, which meant every
 * navigation blocked on notifications and suggestions before any markup went
 * out — including the route's own loading.tsx, which never got a chance to
 * show. Nothing here gates the page, so it streams in after the shell.
 */
export async function TopbarData({
  orgId,
  workspaceSlug,
  userId,
  displayName,
  roleName,
  image,
  avatarUrl,
  workspaces,
}: {
  orgId: string;
  workspaceSlug: string;
  userId: string;
  displayName: string;
  roleName: string;
  image?: string | null;
  avatarUrl?: string | null;
  workspaces: WorkspaceOption[];
}) {
  const now = new Date();

  const [unreadCount, notifications, suggestionRows, settings] = await Promise.all([
    getUnreadCount(orgId, userId),
    getRecentNotifications(orgId, userId, 15),
    prisma.aISuggestion.findMany({
      where: {
        organizationId: orgId,
        userId,
        status: "PENDING",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: { id: true, type: true, reason: true, payload: true },
    }),
    // Read here rather than in the layout: it only feeds the switcher's
    // "Default" line, and the layout is what the page is waiting on.
    prisma.userSettings.findUnique({
      where: { userId },
      select: { defaultOrganizationId: true },
    }),
  ]);

  const suggestions: SuggestionHintRow[] = suggestionRows.map((s) => ({
    id: s.id,
    type: s.type,
    reason: s.reason ?? "",
    actionable: !!(s.payload as SuggestionPayload | null)?.apply,
  }));

  return (
    <Topbar
      displayName={displayName}
      roleName={roleName}
      image={image}
      avatarUrl={avatarUrl}
      userId={userId}
      unreadCount={unreadCount}
      notifications={notifications}
      suggestions={suggestions}
      todayKey={istTodayKey()}
      workspaceSlug={workspaceSlug}
      workspaces={workspaces}
      defaultWorkspaceId={settings?.defaultOrganizationId ?? null}
    />
  );
}

/** Holds the topbar's height so the shell does not reflow when data lands. */
export function TopbarFallback() {
  return (
    <div className="ml-auto flex items-center gap-2">
      <div className="h-8 w-8 rounded-full bg-[color-mix(in_oklab,white_6%,transparent)]" />
      <div className="h-8 w-8 rounded-full bg-[color-mix(in_oklab,white_6%,transparent)]" />
      <span className="mx-1 h-5 w-px bg-border" />
      <div className="h-9 w-[70px] rounded-lg bg-[color-mix(in_oklab,white_6%,transparent)] md:w-[180px]" />
    </div>
  );
}
