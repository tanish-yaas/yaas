import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { PERMISSIONS } from "../src/server/rbac/permissions";

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());