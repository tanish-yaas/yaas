import { prisma } from "@/lib/prisma";
import { normaliseCode } from "@/server/workspace/codes";
import { toHandle } from "@/server/workspace/paths";
import {
  claimDefaultWorkspace,
  ensureWorkspaceMemberSetup,
} from "@/server/workspace/provision";

export type JoinResult =
  | { ok: true; slug: string; status: "ACTIVE" | "PENDING"; name: string }
  | { ok: false; error: string };

/**
 * One phrase for every reason a code will not work.
 *
 * Revoked, expired, used up, wrong address, never existed — a stranger holding
 * a guess must not be able to tell those apart, because the differences map
 * onto "this workspace exists" and "this workspace does not". Members who are
 * genuinely stuck get the real reason from whoever sent them the code.
 */
const BAD_CODE = "That invite code isn't valid, or it has expired.";

/**
 * Redeem an invite code.
 *
 * Joins ACTIVE, not PENDING. Sharing a code is the approval — an admin
 * generated it, chose the role it carries, and sent it to someone. Making the
 * same admin then approve the arrival in a queue is a second lock on the same
 * door, and in practice it just leaves people sitting on /pending wondering
 * whether the code worked.
 */
export async function joinWithCode(
  userId: string,
  rawCode: string,
  userEmail?: string | null
): Promise<JoinResult> {
  const code = normaliseCode(rawCode);
  if (!code) return { ok: false, error: BAD_CODE };

  const invite = await prisma.organizationInvite.findUnique({
    where: { code },
    include: {
      organization: { select: { id: true, name: true, slug: true, deletedAt: true } },
      role: { select: { id: true, key: true } },
    },
  });

  if (!invite || invite.organization.deletedAt) {
    return { ok: false, error: BAD_CODE };
  }
  if (invite.revokedAt) return { ok: false, error: BAD_CODE };
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return { ok: false, error: BAD_CODE };
  }
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
    return { ok: false, error: BAD_CODE };
  }
  if (
    invite.email &&
    invite.email.toLowerCase() !== (userEmail ?? "").toLowerCase()
  ) {
    return { ok: false, error: BAD_CODE };
  }

  const existing = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: invite.organizationId, userId },
    },
  });

  if (existing?.status === "ACTIVE") {
    // Not an error. Someone clicking the same invite link twice should land in
    // the workspace, not read a complaint about it.
    return {
      ok: true,
      slug: invite.organization.slug,
      status: "ACTIVE",
      name: invite.organization.name,
    };
  }

  if (existing?.status === "DEACTIVATED") {
    return {
      ok: false,
      error: "Your access to that workspace was removed. Ask an admin to restore it.",
    };
  }

  const claimed = await prisma.$transaction(async (tx) => {
    // Claim the seat before handing out the membership, with the limit in the
    // WHERE rather than in an if above it. Two people redeeming a one-use code
    // in the same second both passed the check up there; only one of them
    // matches a row here, and the other is told the code is spent.
    const seat = await tx.organizationInvite.updateMany({
      where: {
        id: invite.id,
        revokedAt: null,
        ...(invite.maxUses === null ? {} : { useCount: { lt: invite.maxUses } }),
      },
      data: { useCount: { increment: 1 } },
    });

    if (seat.count === 0) return false;

    // A pending request upgraded by a code keeps its row and gains the role the
    // code carries — the same person, no longer waiting.
    if (existing) {
      await tx.organizationMember.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          roleId: invite.roleId,
          joinMethod: "INVITE_CODE",
          inviteId: invite.id,
          joinedAt: new Date(),
          approvedAt: new Date(),
        },
      });
    } else {
      await tx.organizationMember.create({
        data: {
          organizationId: invite.organizationId,
          userId,
          roleId: invite.roleId,
          status: "ACTIVE",
          joinMethod: "INVITE_CODE",
          inviteId: invite.id,
          joinedAt: new Date(),
          approvedAt: new Date(),
        },
      });
    }

    await tx.auditLog.create({
      data: {
        organizationId: invite.organizationId,
        actorId: userId,
        action: "INVITE",
        entityType: "OrganizationInvite",
        entityId: invite.id,
        after: { joinedVia: "INVITE_CODE", role: invite.role.key },
      },
    });

    return true;
  });

  if (!claimed) return { ok: false, error: BAD_CODE };

  await claimDefaultWorkspace(userId, invite.organizationId);
  await ensureWorkspaceMemberSetup(userId, invite.organizationId);

  return {
    ok: true,
    slug: invite.organization.slug,
    status: "ACTIVE",
    name: invite.organization.name,
  };
}

/**
 * Ask to join a workspace you know the handle of.
 *
 * The fallback for "someone told me the team is on Nova but nobody sent me a
 * code". It only works where an admin has switched join requests on, and it
 * produces a PENDING row — the same queue the members page has always shown.
 *
 * A workspace with requests switched off answers exactly as one that does not
 * exist, so the handle space cannot be walked to discover who is on Nova.
 */
export async function requestToJoin(
  userId: string,
  rawHandle: string
): Promise<JoinResult> {
  const slug = toHandle(rawHandle);
  const notFound = {
    ok: false as const,
    error: "No workspace with that handle is accepting requests.",
  };

  if (!slug) return notFound;

  const org = await prisma.organization.findFirst({
    where: { slug, deletedAt: null },
    include: { settings: true },
  });

  if (!org || !org.settings?.allowSelfSignup) return notFound;

  const existing = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId } },
  });

  if (existing?.status === "ACTIVE") {
    return { ok: true, slug: org.slug, status: "ACTIVE", name: org.name };
  }
  if (existing?.status === "PENDING") {
    return { ok: true, slug: org.slug, status: "PENDING", name: org.name };
  }
  if (existing?.status === "DEACTIVATED") {
    return {
      ok: false,
      error: "Your access to that workspace was removed. Ask an admin to restore it.",
    };
  }

  const fallbackRole = await prisma.role.findFirst({
    where: { organizationId: org.id, key: "MEMBER" },
    select: { id: true },
  });

  const roleId = org.settings.defaultRoleId ?? fallbackRole?.id;
  if (!roleId) return notFound;

  // requireApproval off means the admin has decided the handle is enough. The
  // membership is live immediately and there is nothing in the queue.
  const autoApprove = !org.settings.requireApproval;

  await prisma.$transaction(async (tx) => {
    await tx.organizationMember.create({
      data: {
        organizationId: org.id,
        userId,
        roleId,
        status: autoApprove ? "ACTIVE" : "PENDING",
        joinMethod: "REQUEST",
        joinedAt: autoApprove ? new Date() : null,
        approvedAt: autoApprove ? new Date() : null,
      },
    });

    if (!autoApprove) {
      // Every admin, not just the owner: a request that only pings someone on
      // holiday is a request nobody answers.
      const admins = await tx.organizationMember.findMany({
        where: {
          organizationId: org.id,
          status: "ACTIVE",
          role: { permissions: { some: { permission: { key: "member.approve" } } } },
        },
        select: { userId: true },
      });

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });

      const who = user?.name ?? user?.email ?? "Someone";

      await tx.notification.createMany({
        data: admins.map((admin) => ({
          organizationId: org.id,
          userId: admin.userId,
          type: "MEMBER_JOIN_REQUEST" as const,
          title: "Someone wants to join",
          body: `${who} asked to join ${org.name}.`,
        })),
      });
    }
  });

  if (autoApprove) {
    await claimDefaultWorkspace(userId, org.id);
    await ensureWorkspaceMemberSetup(userId, org.id);
  }

  return {
    ok: true,
    slug: org.slug,
    status: autoApprove ? "ACTIVE" : "PENDING",
    name: org.name,
  };
}
