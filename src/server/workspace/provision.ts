import { prisma } from "@/lib/prisma";
import {
  PERMISSIONS,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
  type PermissionKey,
} from "@/server/rbac/permissions";
import { toHandle, isHandle } from "@/server/workspace/paths";
import { APP_CONFIG } from "@/config/app";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Permission rows are global and seeded by prisma/seed.ts. A workspace created
 * against a database where the seed has not run would otherwise get an ADMIN
 * role with no permissions attached — the founder locked out of the workspace
 * they just made, with nothing on screen explaining why. Creating a workspace
 * is rare enough that making sure first costs nothing.
 */
async function ensurePermissions(tx: Tx) {
  const keys = Object.keys(PERMISSIONS);
  const existing = await tx.permission.findMany({
    where: { key: { in: keys } },
    select: { key: true },
  });

  const missing = keys.filter(
    (key) => !existing.some((p) => p.key === key)
  ) as PermissionKey[];

  for (const key of missing) {
    const [resource, action] = key.split(".");
    await tx.permission.create({
      data: { key, resource, action, description: PERMISSIONS[key] },
    });
  }
}

/**
 * Give a workspace its own copy of the three system roles.
 *
 * Roles are per-organization rather than global (Role.organizationId) so one
 * workspace widening what a Manager may do cannot touch another's. The cost is
 * that every new workspace pays for three inserts here; the alternative is a
 * shared role table nobody can safely edit.
 */
async function createRoles(tx: Tx, organizationId: string) {
  const roleIds: Record<string, string> = {};

  for (const [key, permissionKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await tx.role.create({
      data: {
        key,
        name: ROLE_NAMES[key] ?? key,
        isSystem: true,
        organizationId,
      },
    });
    roleIds[key] = role.id;

    const permissions = await tx.permission.findMany({
      where: { key: { in: permissionKeys as string[] } },
      select: { id: true },
    });

    await tx.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  return roleIds;
}

/**
 * A free handle near the one asked for. Two people naming a workspace "Growth"
 * in the same minute is not an error worth showing either of them, so the
 * second gets growth-2. Bounded because a loop against a unique index is a
 * loop that can run forever if something else is wrong.
 */
async function availableHandle(preferred: string) {
  const base = isHandle(preferred) ? preferred : "workspace";

  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const taken = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}

export type CreateWorkspaceResult =
  | { ok: true; slug: string; organizationId: string }
  | { ok: false; error: string };

/**
 * Found a workspace. The creator is its owner and its first admin — the two
 * are separate ideas (ownership is a column on the org, admin is a role) and
 * both are needed, or nobody can approve the second member.
 */
export async function createWorkspace(
  userId: string,
  input: { name: string; handle?: string }
): Promise<CreateWorkspaceResult> {
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Give the workspace a name" };
  if (name.length > 60) return { ok: false, error: "That name is too long" };

  const wanted = toHandle(input.handle?.trim() || name);
  if (!wanted) {
    return { ok: false, error: "Pick a handle using letters and numbers" };
  }

  const slug = await availableHandle(wanted);

  const organizationId = await prisma.$transaction(async (tx) => {
    await ensurePermissions(tx);

    const org = await tx.organization.create({
      data: { name, slug, ownerId: userId },
    });

    const roleIds = await createRoles(tx, org.id);

    await tx.organizationMember.create({
      data: {
        organizationId: org.id,
        userId,
        roleId: roleIds.ADMIN,
        status: "ACTIVE",
        joinMethod: "FOUNDED",
        joinedAt: new Date(),
        approvedAt: new Date(),
      },
    });

    await tx.organizationSettings.create({
      data: { organizationId: org.id, defaultRoleId: roleIds.MEMBER },
    });

    await tx.auditLog.create({
      data: {
        organizationId: org.id,
        actorId: userId,
        action: "CREATE",
        entityType: "Organization",
        entityId: org.id,
        after: { name, slug },
      },
    });

    return org.id;
  });

  // Your first workspace is the one WhatsApp and Slack file into, and the one
  // / opens. Later ones leave the choice alone — switching that out from under
  // someone because they joined a client's workspace would send their texted
  // tasks somewhere they never look.
  await claimDefaultWorkspace(userId, organizationId);
  await ensureWorkspaceMemberSetup(userId, organizationId);

  return { ok: true, slug, organizationId };
}

/**
 * Point the user's default at this workspace if they have no live default yet.
 * Called after every join as well as after create, because the first workspace
 * someone lands in is just as often one they were invited to.
 */
export async function claimDefaultWorkspace(
  userId: string,
  organizationId: string
) {
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { defaultOrganizationId: true },
  });

  const current = settings?.defaultOrganizationId;

  if (current) {
    const stillAMember = await prisma.organizationMember.findFirst({
      where: { userId, organizationId: current, status: "ACTIVE" },
      select: { id: true },
    });
    if (stillAMember) return;
  }

  await prisma.userSettings.upsert({
    where: { userId },
    update: { defaultOrganizationId: organizationId },
    create: { userId, defaultOrganizationId: organizationId },
  });
}

/**
 * The workspace an inbound message belongs to.
 *
 * Both webhooks used to take findFirst on membership, which was correct while
 * everyone had exactly one and a coin flip afterwards — a task texted in would
 * land in whichever workspace the database happened to return first, and could
 * land somewhere different the next day. The user's stated default settles it,
 * and falls back to their only live membership when they never picked one.
 */
export async function inboundWorkspaceFor(userId: string) {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId, status: "ACTIVE", organization: { deletedAt: null } },
    include: { organization: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 0) return null;
  if (memberships.length === 1) return memberships[0];

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { defaultOrganizationId: true },
  });

  return (
    memberships.find(
      (m) => m.organizationId === settings?.defaultOrganizationId
    ) ?? memberships[0]
  );
}

/**
 * The per-workspace furniture a member needs: a personal calendar and their
 * two default reminder schedules.
 *
 * This used to live in completeOnboarding, which ran exactly once per account
 * — correct when an account meant one workspace, and wrong the moment someone
 * joins a second, where they would have arrived with no calendar to put
 * anything on. So it runs on every way in: founding, redeeming a code, being
 * approved, and finishing onboarding.
 *
 * Idempotent, because those paths overlap: a founder passes through here at
 * create time and again when they finish onboarding.
 */
export async function ensureWorkspaceMemberSetup(
  userId: string,
  organizationId: string
) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      displayName: true,
      timezone: true,
      workingDays: true,
    },
  });

  // Someone who founded a workspace has not filled in onboarding yet. Sensible
  // defaults now beat no calendar at all; completeOnboarding runs through here
  // again once it knows their real name and hours, and the upserts below leave
  // what already exists alone.
  const displayName = profile?.displayName ?? "My";
  const timezone = profile?.timezone ?? APP_CONFIG.timezone;
  const workingDays = profile?.workingDays?.length
    ? profile.workingDays
    : [1, 2, 3, 4, 5];

  const existingCalendar = await prisma.calendar.findFirst({
    where: { ownerId: userId, organizationId, type: "PERSONAL" },
    select: { id: true },
  });

  if (!existingCalendar) {
    await prisma.calendar.create({
      data: {
        organizationId,
        ownerId: userId,
        name: `${displayName}'s Calendar`,
        type: "PERSONAL",
        timezone,
        isDefault: true,
        color: "#7C5CFF",
      },
    });
  }

  const existingSchedules = await prisma.reminderSchedule.count({
    where: { organizationId, userId },
  });

  if (existingSchedules === 0) {
    await prisma.reminderSchedule.createMany({
      data: [
        {
          organizationId,
          userId,
          type: "MORNING_DIGEST",
          channel: "IN_APP",
          timeOfDay: "08:00",
          timezone,
          daysOfWeek: workingDays,
        },
        {
          organizationId,
          userId,
          type: "EVENING_REVIEW",
          channel: "IN_APP",
          timeOfDay: "18:00",
          timezone,
          daysOfWeek: workingDays,
        },
      ],
      skipDuplicates: true,
    });
  }
}
