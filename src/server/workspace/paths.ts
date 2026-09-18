/**
 * Where a workspace lives in the URL, in one place.
 *
 * Everything below /w/<handle> is inside a workspace; everything above it —
 * /login, /welcome, /onboarding — is the part of the app you are in before you
 * have picked one.
 */

export const WORKSPACE_HEADER = "x-nova-workspace";

/** Route pattern, for revalidatePath. Matches the segment, not one workspace. */
export const WS = "/w/[workspace]";

/** A handle is what a slug is called when a person types it. */
const HANDLE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function isHandle(value: string) {
  return HANDLE.test(value);
}

/** Link builder. `wsPath("acme")` → /w/acme, `wsPath("acme", "/tasks")` → /w/acme/tasks. */
export function wsPath(slug: string, path = "") {
  return path === "/" ? `/w/${slug}` : `/w/${slug}${path}`;
}

/**
 * The workspace segment of a path, or null above /w.
 *
 * Runs in the proxy, so it stays a string operation — no database, no session.
 * Anything that looks wrong returns null and the request is treated as having
 * no workspace, which the layout turns into a 404 rather than a redirect into
 * someone else's data.
 */
export function slugFromPathname(pathname: string): string | null {
  if (!pathname.startsWith("/w/")) return null;
  const slug = pathname.slice(3).split("/", 1)[0];
  if (!slug) return null;

  const decoded = safeDecode(slug);
  return decoded && isHandle(decoded) ? decoded : null;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value).toLowerCase();
  } catch {
    // A malformed %-escape is not a workspace anyone has.
    return null;
  }
}

/**
 * Turn anything a person types into a handle. Used by the create form and by
 * the join box, so "Acme Growth", "acme growth" and "/w/acme-growth" all land
 * on the same workspace.
 */
export function toHandle(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/^\/?w\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}
