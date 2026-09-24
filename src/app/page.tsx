import { redirect } from "next/navigation";
import { currentSession } from "@/server/auth/current-session";
import { getDefaultWorkspace } from "@/server/auth/session";
import { wsPath } from "@/server/workspace/paths";

/**
 * The front door. Nobody stays here.
 *
 * Nova has no cross-workspace home screen — every page in the app belongs to
 * one workspace — so / exists to answer "which one?" and get out of the way.
 * A user with no workspaces gets /welcome; one waiting on a request gets
 * /pending; everyone else lands in their default.
 */
export default async function RootPage() {
  const session = await currentSession();
  if (!session?.user?.id) redirect("/login");

  const membership = await getDefaultWorkspace(session.user.id);
  if (!membership) redirect("/welcome");

  if (membership.status === "PENDING") {
    redirect(`/pending?w=${membership.organization.slug}`);
  }

  redirect(wsPath(membership.organization.slug));
}
