import { cache } from "react";
import { headers } from "next/headers";
import { currentSession } from "@/server/auth/current-session";
import { prisma } from "@/lib/prisma";
import { WORKSPACE_HEADER } from "@/server/workspace/paths";

/**
 * The workspace this request is for, as the proxy read it off the URL.
 *
 * Null above /w — the login, welcome and onboarding screens have no workspace
 * yet, and neither do the cron routes.
 */
export const getRequestWorkspaceSlug = cache(async () => {
  const slug = (await headers()).get(WORKSPACE_HEADER);
  return slug && slug.length > 0 ? slug : null;
});

/**
 * Every workspace this user can actually open, newest activity first.
 *
 * Includes PENDING rows: a request you are waiting on is something the
 * switcher should show, greyed, rather than hide until it is granted — the
 * commonest question after asking to join is "did that go through?".
 * DEACTIVATED rows are left out; that door is closed and saying so on every
 * screen helps nobody.
 */
export const listMemberships = cache(async (userId: string) => {
  return prisma.organizationMember.findMany({
    where: {
      userId,
      status: { in: ["ACTIVE", "PENDING"] },
      organization: { deletedAt: null },
    },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, logoUrl: true },
      },
      role: { select: { key: true, name: true } },
    },
    // By name only. Ordering by status would sort on the enum's declaration
    // order — PENDING first — and put the workspaces you cannot open yet at
    // the top of the switcher.
    orderBy: { organization: { name: "asc" } },
  });
});

/**
 * The user's landing workspace: what / redirects to, and where a task texted
 * in over WhatsApp lands when the sender belongs to more than one.
 *
 * defaultOrganizationId is a preference, not a permission, so it is checked
 * against live membership every time rather than trusted — leaving a
 * workspace does not clear it, and a stale id must not strand the user on a
 * dead route.
 */
export const getDefaultWorkspace = cache(async (userId: string) => {
  const [memberships, settings] = await Promise.all([
    listMemberships(userId),
    prisma.userSettings.findUnique({
      where: { userId },
      select: { defaultOrganizationId: true },
    }),
  ]);

  const active = memberships.filter((m) => m.status === "ACTIVE");
  if (active.length === 0) return memberships[0] ?? null;

  const preferred = settings?.defaultOrganizationId
    ? active.find((m) => m.organizationId === settings.defaultOrganizationId)
    : null;

  return preferred ?? active[0];
});

/**
 * Who is asking, in which workspace, holding which permissions.
 *
 * The membership is looked up by (userId, slug) — the pair is the whole
 * authorization check, so a slug for a workspace you are not in returns a null
 * membership and every caller above treats that as a 404. Nothing downstream
 * needs to re-check the tenant.
 *
 * Callers that pass no slug get the request's own, which the proxy put there.
 * That is what lets 68 server actions stay workspace-aware without changing a
 * single signature.
 */
export const getCurrentContext = cache(async (slugOverride?: string) => {
  const session = await currentSession();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const slug = slugOverride ?? (await getRequestWorkspaceSlug());

  const [membership, profile] = await Promise.all([
    slug
      ? prisma.organizationMember.findFirst({
          where: {
            userId,
            organization: { slug, deletedAt: null },
          },
          include: {
            organization: true,
            role: { include: { permissions: { include: { permission: true } } } },
          },
        })
      : Promise.resolve(null),
    prisma.profile.findUnique({ where: { userId } }),
  ]);

  // A pending or deactivated member holds no permissions. The set used to be
  // built from the role either way, which was harmless only because the
  // layout redirected first — an action reached directly would have been
  // waved through on a role the member cannot yet use.
  const permissions = new Set(
    membership?.status === "ACTIVE"
      ? membership.role.permissions.map((rp) => rp.permission.key)
      : []
  );

  return { session, membership, profile, permissions, slug };
});
