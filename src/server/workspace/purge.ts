import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";

/**
 * The storage keys of every file a workspace's tasks carry. Read before the
 * rows go: afterwards there is no record of where those files live.
 */
export async function workspaceFileKeys(organizationIds: string[]) {
  if (organizationIds.length === 0) return [];
  const files = await prisma.attachment.findMany({
    where: { organizationId: { in: organizationIds } },
    select: { storageKey: true },
  });
  return files.map((f) => f.storageKey);
}

/**
 * Delete a workspace and everything in it, for real. The one hard delete in
 * the app — see CLAUDE.md. Call inside a transaction; the caller clears the
 * files afterwards, once the commit has certainly landed.
 *
 * Almost everything hangs off the organization with ON DELETE CASCADE, so the
 * final delete does the work. The four statements before it are the rows the
 * cascade cannot handle on its own.
 */
export async function purgeWorkspace(
  tx: Prisma.TransactionClient,
  organizationId: string
) {
  // Members and invites point at the workspace's roles with ON DELETE
  // RESTRICT. The cascade removes all three, but in an order Postgres picks —
  // clearing these first means a role is never deleted while something still
  // points at it.
  await tx.organizationInvite.deleteMany({ where: { organizationId } });
  await tx.organizationMember.deleteMany({ where: { organizationId } });

  // Both are SET NULL on the organization, so the cascade would leave them
  // behind as ownerless rows.
  await tx.webhookEvent.deleteMany({ where: { organizationId } });
  await tx.auditLog.deleteMany({ where: { organizationId } });

  // A plain column, not a relation — nothing would clear it otherwise.
  await tx.userSettings.updateMany({
    where: { defaultOrganizationId: organizationId },
    data: { defaultOrganizationId: null },
  });

  // Everything else — tasks, events, calendars, diary pages, labels, teams,
  // notifications, AI history, roles, settings — cascades from here.
  await tx.organization.delete({ where: { id: organizationId } });
}

/**
 * Hand a departing member's workspace content to the workspace's owner.
 *
 * Tasks, events and recurring items carry their creator as a required column
 * with ON DELETE CASCADE, so deleting the account would delete the team's work
 * along with it. Leaving a workspace has always promised the opposite — "your
 * tasks, events and notes stay with the workspace" — and deleting an account
 * is leaving every workspace at once, so it keeps the same promise.
 *
 * Comments are the exception: the row stays so replies underneath it survive,
 * but the words go. Someone deleting their account is asking for what they
 * wrote to be gone, and reassigning the text would put their words under
 * somebody else's name.
 */
export async function handOverWorkspaceContent(
  tx: Prisma.TransactionClient,
  userId: string,
  organizationId: string,
  newOwnerId: string
) {
  const where = { organizationId, createdById: userId };

  await tx.task.updateMany({ where, data: { createdById: newOwnerId } });
  await tx.calendarEvent.updateMany({
    where,
    data: { createdById: newOwnerId },
  });
  await tx.organizationInvite.updateMany({
    where,
    data: { createdById: newOwnerId },
  });
  await tx.recurringTask.updateMany({
    where: { organizationId, ownerId: userId },
    data: { ownerId: newOwnerId },
  });

  await tx.taskComment.updateMany({
    where: { organizationId, authorId: userId, deletedAt: null },
    data: { authorId: newOwnerId, body: "", deletedAt: new Date() },
  });
}
