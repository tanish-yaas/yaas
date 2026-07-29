"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/rbac/guard";

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