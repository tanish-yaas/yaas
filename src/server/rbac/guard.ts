import { getCurrentContext } from "@/server/auth/session";
import type { PermissionKey } from "@/server/rbac/permissions";

export class AuthError extends Error {}

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