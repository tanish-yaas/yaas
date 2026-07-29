import { prisma } from "@/lib/prisma";
import {
  ROLE_PERMISSIONS,
  ROLE_NAMES,
  type PermissionKey,
} from "@/server/rbac/permissions";

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "workspace"
  );
}

function orgNameFromEmail(email?: string | null) {
  const domain = email?.split("@")[1]?.split(".")[0];
  if (!domain) return "My Workspace";
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

export async function bootstrapUser(userId: string, email?: string | null) {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const isListedAdmin = !!email && adminEmails.includes(email.toLowerCase());

  const existingOrg = await prisma.organization.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  if (!existingOrg) {
    const name = orgNameFromEmail(email);
    let slug = slugify(name);
    if (await prisma.organization.findUnique({ where: { slug } })) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const roleEntries = Object.entries(ROLE_PERMISSIONS) as [
      string,
      PermissionKey[],
    ][];

    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name, slug, ownerId: userId },
      });

      const roleIds: Record<string, string> = {};

      for (const [key, permissionKeys] of roleEntries) {
        const role = await tx.role.create({
          data: {
            key,
            name: ROLE_NAMES[key] ?? key,
            isSystem: true,
            organizationId: org.id,
          },
        });
        roleIds[key] = role.id;

        const permissions = await tx.permission.findMany({
          where: { key: { in: permissionKeys as string[] } },
          select: { id: true },
        });

        await tx.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId: role.id,
            permissionId: p.id,
          })),
          skipDuplicates: true,
        });
      }

      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId,
          roleId: roleIds.ADMIN,
          status: "ACTIVE",
          joinedAt: new Date(),
          approvedAt: new Date(),
        },
      });

      await tx.organizationSettings.create({
        data: { organizationId: org.id, defaultRoleId: roleIds.MEMBER },
      });
    });

    return;
  }

  const settings = await prisma.organizationSettings.findUnique({
    where: { organizationId: existingOrg.id },
  });

  const fallbackRole = await prisma.role.findFirst({
    where: { organizationId: existingOrg.id, key: "MEMBER" },
  });

  const roleId = settings?.defaultRoleId ?? fallbackRole?.id;
  if (!roleId) throw new Error("No default role configured for organization.");

  const adminRole = await prisma.role.findFirst({
    where: { organizationId: existingOrg.id, key: "ADMIN" },
  });

  await prisma.organizationMember.create({
    data: {
      organizationId: existingOrg.id,
      userId,
      roleId: isListedAdmin && adminRole ? adminRole.id : roleId,
      status: isListedAdmin ? "ACTIVE" : "PENDING",
      joinedAt: isListedAdmin ? new Date() : null,
      approvedAt: isListedAdmin ? new Date() : null,
    },
  });
}