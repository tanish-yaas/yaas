"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/server/auth/current-session";
import { accountDeletionSummary } from "@/server/account/deletion";
import {
  handOverWorkspaceContent,
  purgeWorkspace,
  workspaceFileKeys,
} from "@/server/workspace/purge";
import { DELETE_ACCOUNT_PHRASE } from "@/server/workspace/confirm";
import { removeObjects } from "@/lib/storage";

function list(names: string[]) {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Delete the account, for real.
 *
 * Three different things happen to the three kinds of workspace someone is in,
 * and accountDeletionSummary is the authority on which is which:
 *
 *   - owned, with other people in it → refused. Theirs is not ours to delete.
 *   - owned, nobody else there       → deleted whole, like its own danger zone
 *   - somebody else's                → the seat goes, the work stays
 *
 * Everything personal — profile, settings, diary, reminders, notifications,
 * assistant history, sessions and sign-in links — goes with the user row,
 * which the schema cascades.
 */
export async function deleteAccount(formData: FormData) {
  const session = await currentSession();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const email = session.user.email ?? "";

  const typedEmail = String(formData.get("confirmEmail") ?? "")
    .trim()
    .toLowerCase();
  const typedPhrase = String(formData.get("confirmPhrase") ?? "")
    .trim()
    .toLowerCase();

  if (!email || typedEmail !== email.toLowerCase()) {
    return {
      ok: false as const,
      error: "That isn't the email address on this account",
    };
  }
  if (typedPhrase !== DELETE_ACCOUNT_PHRASE) {
    return {
      ok: false as const,
      error: `Type "${DELETE_ACCOUNT_PHRASE}" to confirm`,
    };
  }

  // Re-read rather than trust the page: a workspace may have gained a member
  // since it rendered, and that is exactly the case this refuses.
  const summary = await accountDeletionSummary(userId);

  if (summary.sharedOwned.length > 0) {
    const names = list(summary.sharedOwned.map((w) => w.name));
    const plural = summary.sharedOwned.length > 1;
    return {
      ok: false as const,
      error: `You still own ${names}, with other people in ${plural ? "them" : "it"}. Delete ${plural ? "them" : "it"} first.`,
    };
  }

  const soloIds = summary.soloOwned.map((w) => w.id);
  const files = await workspaceFileKeys(soloIds);

  await prisma.$transaction(
    async (tx) => {
      for (const workspace of summary.soloOwned) {
        await purgeWorkspace(tx, workspace.id);
      }

      for (const workspace of summary.memberOf) {
        await handOverWorkspaceContent(
          tx,
          userId,
          workspace.id,
          workspace.ownerId
        );
      }

      // Sessions, profile, settings, memberships, assignments, diary pages,
      // reminders, notifications and AI history all cascade from here.
      await tx.user.delete({ where: { id: userId } });

      // Outlives the account, unattached to it: actorId is SET NULL on the
      // user that just went, and the address is kept as text.
      await tx.auditLog.create({
        data: {
          organizationId: null,
          actorEmail: email,
          action: "DELETE",
          entityType: "User",
          entityId: userId,
          before: {
            workspacesDeleted: summary.soloOwned.map((w) => w.slug),
            workspacesLeft: summary.memberOf.map((w) => w.slug),
            files: files.length,
          },
        },
      });
    },
    // The default interactive-transaction timeout is 5s, and this can be
    // several workspaces' worth of cascades.
    { timeout: 60_000, maxWait: 10_000 }
  );

  // After the commit: storage cannot roll back.
  await removeObjects(files);

  // The session rows went with the user, so the cookie in the browser now
  // resolves to nobody — /login is where it lands anyway.
  redirect("/login?deleted=1");
}
