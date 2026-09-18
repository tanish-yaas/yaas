import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { WORKSPACE_HEADER, slugFromPathname } from "@/server/workspace/paths";

/**
 * Carries the active workspace from the URL into the request.
 *
 * Pages could read `params.workspace` and be done with it. Server Actions
 * cannot — they take no route params, and there are 68 of them. What saves us
 * is that an action POSTs *to the page that invoked it*, so the request path
 * for `createTask` fired from /w/acme/tasks is /w/acme/tasks. Parsing the
 * workspace off the path here and hanging it on a request header means one
 * resolver (getCurrentContext) can serve renders and actions alike, and every
 * action keeps the signature it already had.
 *
 * Deriving it from the request rather than a cookie is what makes two
 * workspaces in two tabs behave: each request answers for itself, so a
 * mutation fired in one tab cannot land in the workspace the other tab
 * happens to be showing.
 *
 * The header is set, never merged: a client that sends its own
 * x-nova-workspace has it overwritten here. It is a hint in any case —
 * getCurrentContext still has to find an ACTIVE membership before the slug
 * means anything.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  const slug = slugFromPathname(request.nextUrl.pathname);

  if (slug) headers.set(WORKSPACE_HEADER, slug);
  else headers.delete(WORKSPACE_HEADER);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Static assets and auth callbacks never carry a workspace, and running on
  // them only burns invocations.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.png$).*)"],
};
