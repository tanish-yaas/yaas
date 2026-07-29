import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentContext() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    include: {
      organization: true,
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  const permissions = new Set(
    membership?.role.permissions.map((rp) => rp.permission.key) ?? []
  );

  return { session, membership, profile, permissions };
}