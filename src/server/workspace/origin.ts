import { headers } from "next/headers";

/**
 * The origin the viewer is actually looking at, for links meant to be copied
 * and pasted elsewhere — so an invite link made on a preview deployment or on
 * localhost points back there, not only at the canonical host.
 *
 * Kept out of paths.ts, which client components import: next/headers is
 * server-only.
 */
export async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  return host ? `${protocol}://${host}` : "";
}
