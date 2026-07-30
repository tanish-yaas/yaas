import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const getCurrentContext = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  const [membership, profile] = await Promise.all([
    prisma.organizationMember.findFirst({
      where: { userId },
      include: {
        organization: true,
        role: { include: { permissions: { include: { permission: true } } } },
      },
    }),
    prisma.profile.findUnique({ where: { userId } }),
  ]);

  const permissions = new Set(
    membership?.role.permissions.map((rp) => rp.permission.key) ?? []
  );

  return { session, membership, profile, permissions };
});