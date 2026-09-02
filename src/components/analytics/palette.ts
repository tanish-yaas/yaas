/**
 * Chart colours for the analytics page.
 *
 * Not eyeballed. Every value here was run through the data-viz validator
 * against this app's panel surface (#1d1d20 — --card at 62% over --background)
 * in dark mode, and passes the lightness band, chroma floor, CVD separation,
 * the normal-vision floor and 3:1 contrast.
 *
 * The app's own --chart-1..5 tokens do NOT pass (two of them fall below the
 * chroma floor and read as grey, and green↔blue sit at ΔE 11.8, under the 15
 * floor), so the charts here carry their own slots rather than reusing them.
 * The tokens are left alone — nothing else in the app uses them today.
 */

/** Categorical slots. Assigned in fixed order, never cycled. Worst adjacent
    pair ΔE 26.0 CVD / 27.0 normal-vision at two slots, 9.4 / 26.5 at three. */
export const SERIES = ["#9085e9", "#d95926", "#199e70"] as const;

/**
 * One-hue ordinal ramp, light → dark, for ordered categories (pipeline stages,
 * priority, aging buckets). Validated with --ordinal: monotone lightness, every
 * adjacent ΔL ≥ 0.06, darkest step 2.23:1 on the surface, hue spread 4°.
 *
 * Capped at six steps — a seventh puts two adjacent steps under the ΔL floor.
 */
export const RAMP_4 = ["#c6bbff", "#9f93f4", "#7a6cca", "#5746a0"] as const;
export const RAMP_5 = [
  "#c6bbff",
  "#a99dff",
  "#8c7fdf",
  "#7162bf",
  "#5746a0",
] as const;

/** Reserved state colours. Never used for a series, always with a label. */
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

/**
 * Colours for an ordered set of categories — pipeline stages, priority, aging
 * buckets. One hue, light → dark, so the reader sees the order in the colour.
 *
 * Lives here rather than beside the chart that uses it because the analytics
 * page is a Server Component and calls it while rendering. Exports of a
 * "use client" module are client reference proxies on the server, and calling
 * one throws — which is invisible to tsc and to `next build`, since the page
 * is server-rendered on demand and never prerendered.
 */
export function rampFor(count: number): readonly string[] {
  return count <= 4 ? RAMP_4 : RAMP_5;
}

/**
 * The ink for a label sitting ON a filled mark.
 *
 * Chosen by relative luminance rather than by eye: every ramp step and status
 * colour on this page clears 4.5:1 against the ink this picks (the tightest is
 * #7a6cca at 4.52:1), which small text needs. Text elsewhere always wears a
 * text token — a series colour never carries type.
 */
export function inkOn(hex: string): string {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance =
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance >= 0.185 ? "#0b0b0c" : "#ffffff";
}

/** Chrome. Text always wears a text token, never a series colour. */
export const GRID = "color-mix(in oklab, white 8%, transparent)";
export const AXIS = "color-mix(in oklab, white 14%, transparent)";
/** The 2px gap that separates adjacent fills, painted in the surface. */
export const SURFACE = "#1d1d20";
