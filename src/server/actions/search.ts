"use server";

import { requireContext } from "@/server/rbac/guard";
import { searchWorkspace, type SearchResult } from "@/server/services/search";

export async function runSearch(query: string): Promise<SearchResult[]> {
  const ctx = await requireContext();

  return searchWorkspace({
    query,
    orgId: ctx.membership!.organizationId,
    userId: ctx.session.user.id,
    permissions: ctx.permissions,
  });
}