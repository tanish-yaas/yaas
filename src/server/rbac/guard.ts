import { revalidatePath } from "next/cache";
import { getCurrentContext } from "@/server/auth/session";
import { rateLimit, type RateLimitResult } from "@/lib/rate-limit";
import type { PermissionKey } from "@/server/rbac/permissions";
import { WS } from "@/server/workspace/paths";

export class AuthError extends Error {}
export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Rate limit exceeded");
  }
}

/**
 * The signed-in, active member of the workspace this request is for.
 *
 * The return type narrows `membership` to non-null, so callers downstream read
 * ctx.membership.organizationId without a non-null assertion and without
 * re-deriving which workspace they are in — there is exactly one, and it came
 * from the URL.
 *
 * FORBIDDEN covers three cases that look different to a user and identical to
 * an attacker: no membership at all, a pending request, a deactivated seat.
 * The screens above tell them apart; an action must not.
 */
export async function requireContext() {
  const ctx = await getCurrentContext();
  if (!ctx) throw new AuthError("UNAUTHENTICATED");
  if (!ctx.membership || ctx.membership.status !== "ACTIVE") {
    throw new AuthError("FORBIDDEN");
  }
  return { ...ctx, membership: ctx.membership, slug: ctx.membership.organization.slug };
}

export async function requirePermission(key: PermissionKey) {
  const ctx = await requireContext();
  if (!ctx.permissions.has(key)) throw new AuthError("FORBIDDEN");
  return ctx;
}

/**
 * Revalidate paths inside the current workspace.
 *
 * Actions used to call revalidatePath("/tasks"), which stopped matching
 * anything the moment tasks moved under /w/<handle>/tasks — the mutation would
 * land and the board would keep showing the old rows. Passing the route
 * pattern with type "page" invalidates the segment for every workspace, which
 * is broader than strictly needed and exactly right here: the alternative is
 * threading a slug through fifty call sites to save a cache entry.
 */
export function revalidateWorkspace(...paths: string[]) {
  for (const path of paths) {
    revalidatePath(path === "/" ? WS : `${WS}${path}`, "page");
  }
}

/**
 * Per-user rate limit. Returns the result rather than throwing so
 * callers can surface a friendly message instead of an error page.
 */
export function checkRate(
  userId: string,
  bucket: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  return rateLimit(`${bucket}:${userId}`, limit, windowSeconds);
}
