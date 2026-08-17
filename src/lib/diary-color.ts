import { theme } from "@/config/theme";

export const DIARY_COLORS = theme.diaryPalette;

/**
 * The colour a page starts out as, from its own day key.
 *
 * Pure arithmetic on the date rather than a random pick, for two reasons: the
 * server and the browser have to agree on the colour of an unsaved page, and
 * consecutive days differ by one in the sum — so a week of notes reads as a
 * run of different sticky notes instead of a coincidental block of amber.
 */
export function diaryColorFor(dayKey: string): string {
  let sum = 0;
  for (let i = 0; i < dayKey.length; i += 1) sum += dayKey.charCodeAt(i);
  return DIARY_COLORS[sum % DIARY_COLORS.length];
}

export function isDiaryColor(value: unknown): value is string {
  return (
    typeof value === "string" && (DIARY_COLORS as readonly string[]).includes(value)
  );
}
