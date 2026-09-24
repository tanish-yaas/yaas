import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

/** What the standing code carries, so it reads as what it is on the Members list too. */
export const WORKSPACE_CODE_LABEL = "Workspace invite code";

/**
 * The workspace's standing invite code: the one Settings shows up top for
 * handing to anyone on the team. It is simply the newest live code that
 * makes Members, is not locked to one address, and has no use limit — no
 * flag column, so a code minted that way on the Members page counts too.
 *
 * Codes that make Admins or Managers are never the standing code, however
 * new: a code pinned to the top of Settings gets pasted around, and the role
 * it grants has to be the one nobody would mind.
 */
export function workspaceCodeWhere(organizationId: string): Prisma.OrganizationInviteWhereInput {
  return {
    organizationId,
    revokedAt: null,
    email: null,
    maxUses: null,
    role: { key: "MEMBER" },
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  };
}

export function findWorkspaceCode(organizationId: string) {
  return prisma.organizationInvite.findFirst({
    where: workspaceCodeWhere(organizationId),
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, useCount: true, createdAt: true },
  });
}
