"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/server/rbac/guard";
import { canMutateTask } from "@/server/services/tasks";

function refresh() {
  revalidatePath("/admin/members");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/");
}

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "team"
  );
}

/** Slugs are unique per organization, so retry with a suffix on collision. */
async function uniqueSlug(orgId: string, name: string, ignoreId?: string) {
  const base = slugify(name);
  let slug = base;

  for (let attempt = 0; attempt < 20; attempt++) {
    const clash = await prisma.team.findFirst({
      where: {
        organizationId: orgId,
        slug,
        ...(ignoreId ? { id: { not: ignoreId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${base}-${attempt + 2}`;
  }

  return `${base}-${Date.now().toString(36)}`;
}

export async function createTeam(rawName: string, color: string | null) {
  const ctx = await requirePermission("team.create");
  const orgId = ctx.membership!.organizationId;

  const name = rawName.trim();
  if (!name) return { ok: false as const, error: "Give the team a name" };
  if (name.length > 60) {
    return { ok: false as const, error: "Keep team names under 60 characters" };
  }

  const existing = await prisma.team.findFirst({
    where: { organizationId: orgId, name, deletedAt: null },
    select: { id: true },
  });
  if (existing) return { ok: false as const, error: "That team already exists" };

  const team = await prisma.team.create({
    data: {
      organizationId: orgId,
      name,
      slug: await uniqueSlug(orgId, name),
      color: color ?? null,
    },
  });

  // Whoever creates a team leads it until told otherwise.
  await prisma.teamMember.create({
    data: {
      teamId: team.id,
      userId: ctx.session.user.id,
      organizationId: orgId,
      role: "LEAD",
    },
  });

  refresh();
  return { ok: true as const, id: team.id };
}

export async function renameTeam(
  teamId: string,
  rawName: string,
  color: string | null
) {
  const ctx = await requirePermission("team.manage");
  const orgId = ctx.membership!.organizationId;

  const name = rawName.trim();
  if (!name) return { ok: false as const, error: "Give the team a name" };

  const team = await prisma.team.findFirst({
    where: { id: teamId, organizationId: orgId, deletedAt: null },
    select: { id: true },
  });
  if (!team) return { ok: false as const, error: "Team not found" };

  await prisma.team.update({
    where: { id: teamId },
    data: { name, color, slug: await uniqueSlug(orgId, name, teamId) },
  });

  refresh();
  return { ok: true as const };
}

export async function deleteTeam(teamId: string) {
  const ctx = await requirePermission("team.manage");
  const orgId = ctx.membership!.organizationId;

  const team = await prisma.team.findFirst({
    where: { id: teamId, organizationId: orgId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!team) return { ok: false as const, error: "Team not found" };

  await prisma.$transaction(async (tx) => {
    await tx.team.update({
      where: { id: teamId },
      data: { deletedAt: new Date() },
    });

    // Tasks outlive the team; drop the pointer so scoping stays honest.
    await tx.task.updateMany({
      where: { teamId, organizationId: orgId },
      data: { teamId: null },
    });

    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        action: "DELETE",
        entityType: "Team",
        entityId: teamId,
        before: { name: team.name },
      },
    });
  });

  refresh();
  return { ok: true as const };
}

export async function addTeamMember(
  teamId: string,
  userId: string,
  role: "LEAD" | "MEMBER"
) {
  const ctx = await requirePermission("team.manage");
  const orgId = ctx.membership!.organizationId;

  const [team, member] = await Promise.all([
    prisma.team.findFirst({
      where: { id: teamId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    }),
    prisma.organizationMember.findFirst({
      where: { organizationId: orgId, userId, status: "ACTIVE" },
      select: { id: true },
    }),
  ]);

  if (!team) return { ok: false as const, error: "Team not found" };
  if (!member) return { ok: false as const, error: "Not an active member" };

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId, userId } },
    update: { role },
    create: { teamId, userId, organizationId: orgId, role },
  });

  refresh();
  return { ok: true as const };
}

export async function removeTeamMember(teamId: string, userId: string) {
  const ctx = await requirePermission("team.manage");
  const orgId = ctx.membership!.organizationId;

  const team = await prisma.team.findFirst({
    where: { id: teamId, organizationId: orgId, deletedAt: null },
    select: { id: true },
  });
  if (!team) return { ok: false as const, error: "Team not found" };

  await prisma.teamMember.deleteMany({ where: { teamId, userId } });

  refresh();
  return { ok: true as const };
}

/** Point a task at a team — this is what switches on task.view_team scoping. */
export async function setTaskTeam(taskId: string, teamId: string | null) {
  const ctx = await requirePermission("task.edit_own");
  const orgId = ctx.membership!.organizationId;
  const userId = ctx.session.user.id;

  const task = await canMutateTask(taskId, orgId, userId, ctx.permissions);
  if (!task) return { ok: false as const, error: "Not allowed" };

  if (teamId) {
    const team = await prisma.team.findFirst({
      where: { id: teamId, organizationId: orgId, deletedAt: null },
      select: { id: true },
    });
    if (!team) return { ok: false as const, error: "Team not found" };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { teamId },
  });

  refresh();
  return { ok: true as const };
}
