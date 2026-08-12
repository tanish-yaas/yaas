"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireContext } from "@/server/rbac/guard";
import { isUiScale } from "@/lib/ui-scale";

export async function updateUiScale(scale: string) {
  const ctx = await requireContext();
  const userId = ctx.session.user.id;

  if (!isUiScale(scale)) {
    return { ok: false as const, error: "Unknown size" };
  }

  // Settings rows are created lazily, so a member who has never changed one
  // has no row to update. Upsert rather than assuming onboarding wrote it.
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, uiScale: scale },
    update: { uiScale: scale },
  });

  // The scale is read by the root layout, so every route renders from it.
  revalidatePath("/", "layout");
  return { ok: true as const };
}
