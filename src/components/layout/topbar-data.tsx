import { prisma } from "@/lib/prisma";
import {
  getRecentNotifications,
  getUnreadCount,
} from "@/server/services/notifications";
import { Topbar } from "@/components/layout/topbar";
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
  userId,
  displayName,
  roleName,
  image,
}: {
  orgId: string;
  userId: string;
  displayName: string;
  roleName: string;
  image?: string | null;
}) {
  const now = new Date();

  const [unreadCount, notifications, suggestionRows] = await Promise.all([
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
      unreadCount={unreadCount}
      notifications={notifications}
      suggestions={suggestions}
    />
  );
}

/** Holds the topbar's height so the shell does not reflow when data lands. */
export function TopbarFallback() {
  return (
    <div className="ml-auto flex items-center gap-2">
      <div className="h-8 w-8 rounded-full bg-[color-mix(in_oklab,white_6%,transparent)]" />
      <div className="h-8 w-8 rounded-full bg-[color-mix(in_oklab,white_6%,transparent)]" />
    </div>
  );
}
