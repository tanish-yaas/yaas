import { getCurrentContext } from "@/server/auth/session";
import { rateLimit, type RateLimitResult } from "@/lib/rate-limit";
import type { PermissionKey } from "@/server/rbac/permissions";

export class AuthError extends Error {}
export class RateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Rate limit exceeded");
  }
}

export async function requireContext() {
  const ctx = await getCurrentContext();
  if (!ctx) throw new AuthError("UNAUTHENTICATED");
  if (!ctx.membership || ctx.membership.status !== "ACTIVE") {
    throw new AuthError("FORBIDDEN");
  }
  return ctx;
}

export async function requirePermission(key: PermissionKey) {
  const ctx = await requireContext();
  if (!ctx.permissions.has(key)) throw new AuthError("FORBIDDEN");
  return ctx;
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