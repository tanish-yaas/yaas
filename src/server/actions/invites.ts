"use server";

import { prisma } from "@/lib/prisma";
import { requirePermission, revalidateWorkspace } from "@/server/rbac/guard";
import { generateCode, formatCode } from "@/server/workspace/codes";
import {
  WORKSPACE_CODE_LABEL,
  workspaceCodeWhere,
} from "@/server/workspace/invites";
import { ROLE_NAMES } from "@/server/rbac/permissions";

/** How long "expires in" options run for, in days. Null is "no expiry". */
const EXPIRY_DAYS: Record<string, number | null> = {
  never: null,
  "1d": 1,
  "7d": 7,
  "30d": 30,
};

/**
 * Mint an invite code.
 *
 * The role is fixed here rather than at redemption, which is what lets a code
 * be handed out without a second conversation: an admin decides "this link
 * makes Members" once, and the five people who use it all arrive correctly.
 * Granting ADMIN this way is deliberately possible and deliberately explicit.
 */
export async function createInvite(formData: FormData) {
  const ctx = await requirePermission("member.invite");
  const orgId = ctx.membership.organizationId;

  const roleKey = String(formData.get("roleKey") ?? "MEMBER");
  const label = String(formData.get("label") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const expiry = String(formData.get("expiry") ?? "7d");
  const rawMaxUses = String(formData.get("maxUses") ?? "").trim();

  if (!ROLE_NAMES[roleKey]) {
    return { ok: false as const, error: "Unknown role" };
  }

  // Only an admin may mint admin codes. A Manager holds member.invite, and
  // without this the invite form would be a way around member.assign_role.
  if (roleKey === "ADMIN" && !ctx.permissions.has("member.assign_role")) {
    return { ok: false as const, error: "You can't create admin invites" };
  }

  const role = await prisma.role.findFirst({
    where: { organizationId: orgId, key: roleKey },
    select: { id: true },
  });
  if (!role) return { ok: false as const, error: "Role not set up here" };

  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return {
      ok: false as const,
      error: "That doesn't look like an email address",
    };
  }

  const maxUses = rawMaxUses ? Number(rawMaxUses) : null;
  if (
    maxUses !== null &&
    (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 500)
  ) {
    return {
      ok: false as const,
      error: "Uses must be a number between 1 and 500",
    };
  }

  const days = EXPIRY_DAYS[expiry] ?? null;
  const expiresAt = days
    ? new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    : null;

  const invite = await prisma.organizationInvite.create({
    data: {
      organizationId: orgId,
      roleId: role.id,
      createdById: ctx.session.user.id,
      code: generateCode(),
      label: label || null,
      // An address-locked invite is for one person, so it is one use unless
      // the admin said otherwise — the field would otherwise read "unlimited"
      // next to a single name, which is not what anyone means by it.
      maxUses: maxUses ?? (email ? 1 : null),
      email: email || null,
      expiresAt,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      actorId: ctx.session.user.id,
      actorEmail: ctx.session.user.email,
      action: "INVITE",
      entityType: "OrganizationInvite",
      entityId: invite.id,
      after: { role: roleKey, maxUses: invite.maxUses, email: invite.email },
    },
  });

  revalidateWorkspace("/admin/members", "/settings");

  // Returned, not just revalidated: the admin is about to paste this
  // somewhere, and making them hunt for the new row in the list is a worse
  // first second than handing it straight back.
  return { ok: true as const, code: formatCode(invite.code) };
}

/**
 * Mint the workspace's standing code — Member, no expiry, no use limit — for
 * the Settings page, where a workspace with no code yet offers to make one.
 */
export async function createWorkspaceCode() {
  const ctx = await requirePermission("member.invite");
  const orgId = ctx.membership.organizationId;

  const role = await prisma.role.findFirst({
    where: { organizationId: orgId, key: "MEMBER" },
    select: { id: true },
  });
  if (!role) return { ok: false as const, error: "Role not set up here" };

  const invite = await prisma.$transaction(async (tx) => {
    const created = await tx.organizationInvite.create({
      data: {
        organizationId: orgId,
        roleId: role.id,
        createdById: ctx.session.user.id,
        code: generateCode(),
        label: WORKSPACE_CODE_LABEL,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        action: "INVITE",
        entityType: "OrganizationInvite",
        entityId: created.id,
        after: { role: "MEMBER", standing: true },
      },
    });

    return created;
  });

  revalidateWorkspace("/settings", "/admin/members");
  return { ok: true as const, code: formatCode(invite.code) };
}

/**
 * Swap the standing code for a new one, for when it has been posted somewhere
 * it should not have been. The old code stops working at once; everyone who
 * already joined through it stays.
 *
 * Only ever replaces a standing code, and always with a Member one. The id
 * comes from the client, and without the check this would turn any code —
 * an admin one, say — into a Member code with no expiry and no limit.
 */
export async function resetWorkspaceCode(inviteId: string) {
  const ctx = await requirePermission("member.invite");
  const orgId = ctx.membership.organizationId;

  const current = await prisma.organizationInvite.findFirst({
    where: { ...workspaceCodeWhere(orgId), id: inviteId },
    select: { id: true, roleId: true },
  });
  if (!current) {
    return {
      ok: false as const,
      error: "That code has already changed. Refresh the page",
    };
  }

  const invite = await prisma.$transaction(async (tx) => {
    await tx.organizationInvite.update({
      where: { id: current.id },
      data: { revokedAt: new Date() },
    });

    const created = await tx.organizationInvite.create({
      data: {
        organizationId: orgId,
        roleId: current.roleId,
        createdById: ctx.session.user.id,
        code: generateCode(),
        label: WORKSPACE_CODE_LABEL,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        action: "UPDATE",
        entityType: "OrganizationInvite",
        entityId: created.id,
        before: { replaced: current.id },
        after: { role: "MEMBER", standing: true },
      },
    });

    return created;
  });

  revalidateWorkspace("/settings", "/admin/members");
  return { ok: true as const, code: formatCode(invite.code) };
}

/**
 * Revoke a code. Kept as a row rather than deleted — members who joined
 * through it still point at it, and "who let this person in" is a question
 * that gets asked long after the code stopped working.
 */
export async function revokeInvite(inviteId: string) {
  const ctx = await requirePermission("member.invite");
  const orgId = ctx.membership.organizationId;

  const invite = await prisma.organizationInvite.findFirst({
    where: { id: inviteId, organizationId: orgId, revokedAt: null },
    select: { id: true },
  });
  if (!invite) return { ok: false as const, error: "No such invite" };

  await prisma.$transaction(async (tx) => {
    await tx.organizationInvite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        action: "DELETE",
        entityType: "OrganizationInvite",
        entityId: inviteId,
        after: { revoked: true },
      },
    });
  });

  revalidateWorkspace("/admin/members", "/settings");
  return { ok: true as const };
}
