"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/rbac/guard";
import { canMutateTask } from "@/server/services/tasks";
import { theme } from "@/config/theme";

const PALETTE = theme.labelPalette;
const HEX = /^#[0-9a-fA-F]{6}$/;

function refresh() {
  revalidatePath("/tasks");
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function createLabel(rawName: string, color: string) {
  const ctx = await requirePermission("task.create");
  const orgId = ctx.membership!.organizationId;

  const name = rawName.trim();
  if (!name) return { ok: false as const, error: "Give the label a name" };
  if (name.length > 40) {
    return { ok: false as const, error: "Keep label names under 40 characters" };
  }
  if (!HEX.test(color)) {
    return { ok: false as const, error: "Pick a colour from the palette" };
  }

  const existing = await prisma.label.findFirst({
    where: { organizationId: orgId, name },
    select: { id: true },
  });
  if (existing) {
    return { ok: false as const, error: "That label already exists" };
  }

  const label = await prisma.label.create({
    data: {
      organizationId: orgId,
      name,
      color,
      createdById: ctx.session.user.id,
    },
  });

  refresh();
  return { ok: true as const, id: label.id };
}

export async function updateLabel(
  labelId: string,
  rawName: string,
  color: string
) {
  const ctx = await requirePermission("task.create");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const name = rawName.trim();
  if (!name) return { ok: false as const, error: "Give the label a name" };
  if (!HEX.test(color)) {
    return { ok: false as const, error: "Pick a colour from the palette" };
  }

  const label = await prisma.label.findFirst({
    where: { id: labelId, organizationId: orgId },
    select: { id: true, createdById: true },
  });
  if (!label) return { ok: false as const, error: "Label not found" };

  const allowed =
    label.createdById === userId || ctx.permissions.has("org.settings");
  if (!allowed) return { ok: false as const, error: "Not allowed" };

  const clash = await prisma.label.findFirst({
    where: { organizationId: orgId, name, id: { not: labelId } },
    select: { id: true },
  });
  if (clash) return { ok: false as const, error: "That name is taken" };

  await prisma.label.update({ where: { id: labelId }, data: { name, color } });

  refresh();
  return { ok: true as const };
}

/**
 * Labels have no deletedAt column, so removal is a real delete — TaskLabel rows
 * cascade with it. The tasks themselves are untouched.
 */
export async function deleteLabel(labelId: string) {
  const ctx = await requirePermission("task.create");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const label = await prisma.label.findFirst({
    where: { id: labelId, organizationId: orgId },
    select: { id: true, name: true, createdById: true },
  });
  if (!label) return { ok: false as const, error: "Label not found" };

  const allowed =
    label.createdById === userId || ctx.permissions.has("org.settings");
  if (!allowed) return { ok: false as const, error: "Not allowed" };

  await prisma.$transaction(async (tx) => {
    await tx.label.delete({ where: { id: labelId } });
    await tx.activityLog.create({
      data: {
        organizationId: orgId,
        userId,
        action: "label.deleted",
        entityType: "Label",
        entityId: labelId,
        metadata: { name: label.name },
      },
    });
  });

  refresh();
  return { ok: true as const };
}

/** Replace a task's labels wholesale — simpler than diffing on the client. */
export async function setTaskLabels(taskId: string, labelIds: string[]) {
  const ctx = await requirePermission("task.edit_own");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const task = await canMutateTask(taskId, orgId, userId, ctx.permissions);
  if (!task) return { ok: false as const, error: "Not allowed" };

  const valid = await prisma.label.findMany({
    where: { organizationId: orgId, id: { in: labelIds } },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.taskLabel.deleteMany({ where: { taskId } });
    if (valid.length > 0) {
      await tx.taskLabel.createMany({
        data: valid.map((l) => ({
          organizationId: orgId,
          taskId,
          labelId: l.id,
        })),
        skipDuplicates: true,
      });
    }
  });

  refresh();
  return { ok: true as const };
}
