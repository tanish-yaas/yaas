"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { currentSession } from "@/server/auth/current-session";
import {
  requireContext,
  requirePermission,
  checkRate,
} from "@/server/rbac/guard";
import { createWorkspace } from "@/server/workspace/provision";
import { joinWithCode, requestToJoin } from "@/server/workspace/join";
import { normaliseCode } from "@/server/workspace/codes";
import { toHandle, wsPath, WS } from "@/server/workspace/paths";
import { DELETE_WORKSPACE_PHRASE } from "@/server/workspace/confirm";
import { purgeWorkspace, workspaceFileKeys } from "@/server/workspace/purge";
import { removeObjects } from "@/lib/storage";

/** Signed in, but not yet anywhere. Everything on /welcome runs through here. */
async function requireUser() {
  const session = await currentSession();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

/**
 * After joining or founding, send the user where they can actually do
 * something: the workspace if their profile is set up, /onboarding if this is
 * their first time and Nova still needs to know their name and working hours.
 */
async function landAfterJoin(userId: string, slug: string): Promise<never> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });

  redirect(
    profile ? wsPath(slug) : `/onboarding?next=${encodeURIComponent(slug)}`,
  );
}

export async function createWorkspaceAction(formData: FormData) {
  const user = await requireUser();

  // Workspaces are cheap to make and awkward to delete, and an unthrottled
  // create is a way to fill the organizations table from one signed-in tab.
  const rate = checkRate(user.id, "workspace:create", 5, 60 * 60);
  if (!rate.allowed) {
    redirect(
      `/welcome/create?error=${encodeURIComponent("You've created a few workspaces just now. Try again in a little while.")}`,
    );
  }

  const result = await createWorkspace(user.id, {
    name: String(formData.get("name") ?? ""),
    handle: String(formData.get("handle") ?? ""),
  });

  if (!result.ok) {
    redirect(`/welcome/create?error=${encodeURIComponent(result.error)}`);
  }

  await landAfterJoin(user.id, result.slug);
}

/**
 * One box, two ways in. A code redeems; anything else is read as a handle and
 * becomes a request, which only lands where an admin has opened that door.
 * Asking the user to first classify what they were sent is a question they
 * cannot reliably answer.
 */
export async function joinWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  const input = String(formData.get("code") ?? "").trim();

  if (!input) {
    redirect(
      `/welcome/join?error=${encodeURIComponent("Enter an invite code or workspace handle")}`,
    );
  }

  // Codes are guessable only by brute force, so the rate limit is the thing
  // that makes brute force not worth starting.
  const rate = checkRate(user.id, "workspace:join", 10, 10 * 60);
  if (!rate.allowed) {
    redirect(
      `/welcome/join?error=${encodeURIComponent("Too many tries. Wait a few minutes.")}`,
    );
  }

  const result = normaliseCode(input)
    ? await joinWithCode(user.id, input, user.email)
    : await requestToJoin(user.id, input);

  if (!result.ok) {
    redirect(`/welcome/join?error=${encodeURIComponent(result.error)}`);
  }

  if (result.status === "PENDING") redirect(`/pending?w=${result.slug}`);

  await landAfterJoin(user.id, result.slug);
}

/**
 * Which workspace / opens, and where a texted task lands. Verified against
 * live membership rather than taken on trust — the id arrives from the client.
 */
export async function setDefaultWorkspace(organizationId: string) {
  const user = await requireUser();

  const membership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, organizationId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!membership)
    return { ok: false as const, error: "You're not in that workspace" };

  await prisma.userSettings.upsert({
    where: { userId: user.id },
    update: { defaultOrganizationId: organizationId },
    create: { userId: user.id, defaultOrganizationId: organizationId },
  });

  revalidatePath(WS, "layout");
  return { ok: true as const };
}

/** Rename the workspace, or change the handle every member's URLs run through. */
export async function updateWorkspace(formData: FormData) {
  const ctx = await requirePermission("org.settings");
  const orgId = ctx.membership.organizationId;

  const name = String(formData.get("name") ?? "").trim();
  const handle = toHandle(String(formData.get("handle") ?? ""));
  const allowRequests = formData.get("allowRequests") === "on";

  if (name.length < 2 || name.length > 60) {
    return { ok: false as const, error: "Give the workspace a name" };
  }
  if (!handle) {
    return {
      ok: false as const,
      error: "Handles use letters, numbers and dashes",
    };
  }

  if (handle !== ctx.membership.organization.slug) {
    const taken = await prisma.organization.findUnique({
      where: { slug: handle },
      select: { id: true },
    });
    if (taken) return { ok: false as const, error: "That handle is taken" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: orgId },
      data: { name, slug: handle },
    });

    await tx.organizationSettings.upsert({
      where: { organizationId: orgId },
      update: { allowSelfSignup: allowRequests },
      create: { organizationId: orgId, allowSelfSignup: allowRequests },
    });

    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: ctx.session.user.id,
        actorEmail: ctx.session.user.email,
        action: "UPDATE",
        entityType: "Organization",
        entityId: orgId,
        before: {
          name: ctx.membership.organization.name,
          slug: ctx.membership.organization.slug,
        },
        after: { name, slug: handle, allowSelfSignup: allowRequests },
      },
    });
  });

  revalidatePath(WS, "layout");

  // The handle is in the URL of the page that called this, so staying put
  // would leave the browser on a route that no longer resolves.
  if (handle !== ctx.membership.organization.slug) {
    redirect(wsPath(handle, "/settings"));
  }

  return { ok: true as const };
}

/**
 * Leave a workspace. Nothing the member made is deleted — their tasks, events
 * and diary pages belong to the workspace and stay in it. This closes their
 * seat, which is the part that is theirs to close.
 */
export async function leaveWorkspace() {
  const ctx = await requireContext();
  const userId = ctx.session.user.id;
  const orgId = ctx.membership.organizationId;

  // The owner leaving would strand the workspace with no one able to grant
  // roles. Handing ownership over is a different action than this one.
  if (ctx.membership.organization.ownerId === userId) {
    return {
      ok: false as const,
      error: "You own this workspace. Transfer it to someone else first.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.organizationMember.delete({ where: { id: ctx.membership.id } });
    await tx.teamMember.deleteMany({
      where: { userId, organizationId: orgId },
    });

    await tx.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: userId,
        actorEmail: ctx.session.user.email,
        action: "DELETE",
        entityType: "OrganizationMember",
        entityId: ctx.membership.id,
        after: { left: true },
      },
    });
  });

  // They may have been standing in the workspace they were defaulted to.
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { defaultOrganizationId: true },
  });

  if (settings?.defaultOrganizationId === orgId) {
    // Read past listMemberships: it is request-cached and would still be
    // holding the seat this action just deleted.
    const rest = await prisma.organizationMember.findFirst({
      where: {
        userId,
        status: "ACTIVE",
        organizationId: { not: orgId },
        organization: { deletedAt: null },
      },
      select: { organizationId: true },
    });
    await prisma.userSettings.update({
      where: { userId },
      data: { defaultOrganizationId: rest?.organizationId ?? null },
    });
  }

  redirect("/");
}

/**
 * Delete the workspace, for real: every row it owns and every file its tasks
 * carry. The one hard delete in the app — everywhere else sets deletedAt —
 * because the point of deleting a whole workspace is that it stops taking up
 * space, and a soft-deleted one would sit in every table forever.
 *
 * The owner only, and only with the workspace's name and the confirmation
 * sentence typed out. Both are checked here again: the dialog greys its
 * button out until they match, but a form can be posted without it.
 */
export async function deleteWorkspace(formData: FormData) {
  const ctx = await requireContext();
  const userId = ctx.session.user.id;
  const org = ctx.membership.organization;

  if (org.ownerId !== userId) {
    return {
      ok: false as const,
      error: "Only the owner can delete this workspace",
    };
  }

  const typedName = String(formData.get("confirmName") ?? "").trim();
  const typedPhrase = String(formData.get("confirmPhrase") ?? "")
    .trim()
    .toLowerCase();

  if (typedName !== org.name.trim()) {
    return { ok: false as const, error: "The workspace name doesn't match" };
  }
  if (typedPhrase !== DELETE_WORKSPACE_PHRASE) {
    return {
      ok: false as const,
      error: `Type "${DELETE_WORKSPACE_PHRASE}" to confirm`,
    };
  }

  const files = await workspaceFileKeys([org.id]);

  await prisma.$transaction(
    async (tx) => {
      await purgeWorkspace(tx, org.id);

      // The one row that outlives it: who deleted what, and when. A few
      // hundred bytes, unattached to any workspace.
      await tx.auditLog.create({
        data: {
          organizationId: null,
          actorId: userId,
          actorEmail: ctx.session.user.email,
          action: "DELETE",
          entityType: "Organization",
          entityId: org.id,
          before: { name: org.name, slug: org.slug, files: files.length },
        },
      });
    },
    // The default interactive-transaction timeout is 5s, and a workspace with
    // a few years of history cascades through a lot of rows.
    { timeout: 60_000, maxWait: 10_000 }
  );

  // After the commit, not inside it: storage cannot roll back, so the files go
  // only once the rows that reference them are certainly gone.
  await removeObjects(files);

  revalidatePath(WS, "layout");

  // / sends them to another workspace they belong to, or to /welcome when this
  // was the only one.
  redirect("/");
}
