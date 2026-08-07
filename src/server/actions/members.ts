"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/rbac/guard";
import { ROLE_NAMES } from "@/server/rbac/permissions";

export async function approveMember(formData: FormData) {
  const ctx = await requirePermission("member.approve");
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return;

  const member = await prisma.organizationMember.findFirst({
    where: {
      id: memberId,
      organizationId: ctx.membership!.organizationId,
      status: "PENDING",
    },
  });
  if (!member) return;

  await prisma.$transaction(async (tx) => {
    await tx.organizationMember.update({
      where: { id: memberId },
      data: {
        status: "ACTIVE",
        approvedById: ctx.session.user.id,
        approvedAt: new Date(),
        joinedAt: new Date(),
      },
    });

    await tx.notification.create({
      data: {
        organizationId: member.organizationId,
        userId: member.userId,
        type: "MEMBER_APPROVED",
        title: "You're in",
        body: "An admin approved your access to the workspace.",
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: member.organizationId,
        actorId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        action: "APPROVE",
        entityType: "OrganizationMember",
        entityId: memberId,
      },
    });
  });

  revalidatePath("/admin/members");
}

/**
 * Promote or demote a member. Granting ADMIN is how you add a co-admin — the
 * role carries every permission, so it is the same access the owner has.
 */
export async function changeMemberRole(memberId: string, roleKey: string) {
  const ctx = await requirePermission("member.assign_role");
  const orgId = ctx.membership!.organizationId;

  if (!ROLE_NAMES[roleKey]) {
    return { ok: false as const, error: "Unknown role" };
  }

  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId: orgId, status: "ACTIVE" },
    include: { role: true },
  });
  if (!member) return { ok: false as const, error: "No such member" };

  // Changing your own role is how you accidentally lock yourself out.
  if (member.userId === ctx.session.user.id) {
    return { ok: false as const, error: "You can't change your own role" };
  }

  if (member.role.key === roleKey) return { ok: true as const };

  // An org with no admin left cannot approve members or grant roles again.
  if (member.role.key === "ADMIN") {
    const admins = await prisma.organizationMember.count({
      where: {
        organizationId: orgId,
        status: "ACTIVE",
        role: { key: "ADMIN" },
      },
    });
    if (admins <= 1) {
      return { ok: false as const, error: "That's the only admin left" };
    }
  }

  const role = await prisma.role.findFirst({
    where: { organizationId: orgId, key: roleKey },
  });
  if (!role) return { ok: false as const, error: "Role not set up here" };

  await prisma.$transaction(async (tx) => {
    await tx.organizationMember.update({
      where: { id: memberId },
      data: { roleId: role.id },
    });

    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        action: "UPDATE",
        entityType: "OrganizationMember",
        entityId: memberId,
        before: { role: member.role.key },
        after: { role: roleKey },
      },
    });
  });

  revalidatePath("/admin/members");
  return { ok: true as const };
}

export async function deactivateMember(formData: FormData) {
  const ctx = await requirePermission("member.deactivate");
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return;

  const member = await prisma.organizationMember.findFirst({
    where: { id: memberId, organizationId: ctx.membership!.organizationId },
  });
  if (!member) return;
  if (member.userId === ctx.session.user.id) return;

  await prisma.$transaction(async (tx) => {
    await tx.organizationMember.update({
      where: { id: memberId },
      data: { status: "DEACTIVATED", deactivatedAt: new Date() },
    });

    await tx.session.deleteMany({ where: { userId: member.userId } });

    await tx.auditLog.create({
      data: {
        organizationId: member.organizationId,
        actorId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        action: "UPDATE",
        entityType: "OrganizationMember",
        entityId: memberId,
        after: { status: "DEACTIVATED" },
      },
    });
  });

  revalidatePath("/admin/members");
}