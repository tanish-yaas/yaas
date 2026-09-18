"use client";

import { useParams } from "next/navigation";
import { wsPath } from "@/server/workspace/paths";

/**
 * Resolve a workspace-relative path from inside a client component.
 *
 * Every component under /w/[workspace] can read the segment straight off the
 * route, so links stay correct without threading a slug down through props
 * that exist for no other reason. Falls back to the bare path outside a
 * workspace, which is only the pre-workspace screens.
 */
export function useWorkspaceLink() {
  const params = useParams<{ workspace?: string | string[] }>();
  const raw = params?.workspace;
  const slug = Array.isArray(raw) ? raw[0] : raw;

  return (path: string) => (slug ? wsPath(slug, path) : path);
}

/**
 * The current workspace's handle, for scoping per-viewer browser state.
 *
 * Preferences stored as sets of ids — a hidden-calendar set, a people filter —
 * are only meaningful inside the workspace the ids came from. Stored under one
 * global key they follow you across the switcher: the people filter is the bad
 * case, because user ids *are* global, so a selection made in one workspace
 * silently matches nobody in the next and the board goes blank with no filter
 * chip to explain it.
 */
export function useWorkspaceKey(name: string) {
  const params = useParams<{ workspace?: string | string[] }>();
  const raw = params?.workspace;
  const slug = Array.isArray(raw) ? raw[0] : raw;

  return slug ? `${name}.${slug}` : name;
}
