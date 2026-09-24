import { prisma } from "@/lib/prisma";

export type DeletionWorkspace = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  /** Active members other than this user. */
  otherMembers: number;
};

export type AccountDeletionSummary = {
  /** Yours alone — deleted with the account, everything in them included. */
  soloOwned: DeletionWorkspace[];
  /** Yours, but other people are in them. These block the deletion. */
  sharedOwned: DeletionWorkspace[];
  /** Someone else's — your seat goes, your work stays behind. */
  memberOf: DeletionWorkspace[];
};

/**
 * What deleting this account would do, for the dialog to spell out and for the
 * action to enforce. One function, so the warning and the rule cannot drift.
 *
 * Owning a workspace other people are in blocks the deletion rather than
 * taking their workspace down with it — the same line GitHub draws around
 * organizations. The way out is to delete the workspace, which its own
 * danger zone does.
 */
export async function accountDeletionSummary(
  userId: string
): Promise<AccountDeletionSummary> {
  const [memberships, owned] = await Promise.all([
    prisma.organizationMember.findMany({
      where: {
        userId,
        status: "ACTIVE",
        organization: { deletedAt: null },
      },
      select: {
        organization: {
          select: { id: true, name: true, slug: true, ownerId: true },
        },
      },
    }),
    prisma.organization.findMany({
      where: { ownerId: userId, deletedAt: null },
      select: { id: true, name: true, slug: true, ownerId: true },
    }),
  ]);

  const ownedIds = owned.map((o) => o.id);

  // Grouped rather than a filtered _count per row: one query whatever the
  // number of workspaces.
  const others =
    ownedIds.length > 0
      ? await prisma.organizationMember.groupBy({
          by: ["organizationId"],
          where: {
            organizationId: { in: ownedIds },
            status: "ACTIVE",
            userId: { not: userId },
          },
          _count: { _all: true },
        })
      : [];

  const otherCount = new Map(
    others.map((row) => [row.organizationId, row._count._all])
  );

  const soloOwned: DeletionWorkspace[] = [];
  const sharedOwned: DeletionWorkspace[] = [];

  for (const org of owned) {
    const entry = { ...org, otherMembers: otherCount.get(org.id) ?? 0 };
    if (entry.otherMembers > 0) sharedOwned.push(entry);
    else soloOwned.push(entry);
  }

  const memberOf = memberships
    .map((m) => m.organization)
    .filter((org) => org.ownerId !== userId)
    .map((org) => ({ ...org, otherMembers: 0 }));

  return { soloOwned, sharedOwned, memberOf };
}
