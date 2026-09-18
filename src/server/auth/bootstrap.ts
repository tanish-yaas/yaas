import { prisma } from "@/lib/prisma";

/**
 * What happens the first time an account exists.
 *
 * It used to be a lot: find the one organization, or create it, and push the
 * new user into it — PENDING unless their address was in ADMIN_EMAILS. That
 * was the single-workspace assumption in its purest form. A second workspace
 * would have been unreachable, because every new account was posted to the
 * oldest one regardless of who invited them.
 *
 * Now signing in gets you an account and nothing else. Where you belong is a
 * choice you make on /welcome — found a workspace, or redeem the code someone
 * sent you — and both paths go through createWorkspace/joinWithCode, which are
 * also the paths an existing user takes for their second workspace. One way in
 * per outcome, rather than one for the first user and another for the rest.
 */
export async function bootstrapUser(userId: string) {
  await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}
