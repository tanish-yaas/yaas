import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from "../src/server/rbac/permissions";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const entries = Object.entries(PERMISSIONS) as [string, string][];

  for (const [key, description] of entries) {
    const [resource, action] = key.split(".");
    await prisma.permission.upsert({
      where: { key },
      update: { description, resource, action },
      create: { key, resource, action, description },
    });
  }

  console.log(`Seeded ${entries.length} permissions.`);

  // Roles are wired up once, when the first organization is bootstrapped. Any
  // permission added to the codebase after that never reaches an existing
  // role, so re-link them here. Additive only — nothing is revoked.
  const roles = await prisma.role.findMany({
    where: { key: { in: Object.keys(ROLE_PERMISSIONS) } },
    select: { id: true, key: true, organizationId: true },
  });

  let linked = 0;

  for (const role of roles) {
    const wanted = ROLE_PERMISSIONS[role.key] ?? [];
    if (wanted.length === 0) continue;

    const permissions = await prisma.permission.findMany({
      where: { key: { in: wanted as string[] } },
      select: { id: true },
    });

    const result = await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });

    linked += result.count;
  }

  console.log(
    `Checked ${roles.length} roles, added ${linked} missing permission links.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());