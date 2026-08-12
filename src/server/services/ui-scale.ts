import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_UI_SCALE, isUiScale, type UiScale } from "@/lib/ui-scale";

/**
 * The viewer's interface scale, for the root layout.
 *
 * Deliberately not routed through getCurrentContext: the root layout also wraps
 * /login, /pending and /onboarding, where there is no membership and that
 * lookup would be wasted work. This needs the session and one narrow row.
 *
 * Signed out, or a settings row that was never written, both fall back to the
 * default rather than failing the layout.
 */
export const getUiScale = cache(async (): Promise<UiScale> => {
  try {
    const session = await auth();
    if (!session?.user?.id) return DEFAULT_UI_SCALE;

    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: { uiScale: true },
    });

    return isUiScale(settings?.uiScale) ? settings.uiScale : DEFAULT_UI_SCALE;
  } catch {
    // The scale is a preference, not a gate. A database blip should render the
    // app at the default, not blank the page.
    return DEFAULT_UI_SCALE;
  }
});
