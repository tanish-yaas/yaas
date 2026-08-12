/**
 * The interface scale preference, and the coordinate maths that comes with it.
 *
 * The scale is applied as `zoom` on the root element (see globals.css), which
 * scales layout rather than only type. The cost of that is a second coordinate
 * space: the browser reports geometry in screen pixels, but an element
 * positioned inside the zoomed root is laid out in zoomed pixels. Mixing the
 * two puts an overlay a few percent off its trigger — visible at 0.875 and
 * 1.125, invisible at 1, which is exactly how it slips through review.
 *
 * Anything that measures with getBoundingClientRect() or reads a pointer
 * coordinate and then feeds it back into styles goes through toZoomed() /
 * viewportSize() here.
 */

export const UI_SCALES = ["small", "medium", "large"] as const;

export type UiScale = (typeof UI_SCALES)[number];

export const DEFAULT_UI_SCALE: UiScale = "medium";

export function isUiScale(value: unknown): value is UiScale {
  return (
    typeof value === "string" && (UI_SCALES as readonly string[]).includes(value)
  );
}

export const UI_SCALE_LABELS: Record<UiScale, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

/** Kept in step with the ratios in globals.css, for previews and copy. */
export const UI_SCALE_RATIOS: Record<UiScale, number> = {
  small: 0.875,
  medium: 1,
  large: 1.125,
};

/**
 * The factor to divide reported geometry by, for `element`.
 *
 * The two `zoom` implementations disagree about which space they report in,
 * and the disagreement is invisible at scale 1 — which is how it would reach
 * production:
 *
 * - Standardised zoom (Chrome 128+, Firefox 126+, Safari 18+) reports
 *   getBoundingClientRect() in *screen* pixels, and exposes currentCSSZoom so
 *   you can convert back. Here we must divide.
 * - Legacy zoom (Chrome ≤127) reports rects in *layout* pixels already, which
 *   is the same space a fixed child of the zoomed root is positioned in. Here
 *   dividing would introduce the very error it looks like it is fixing.
 *
 * currentCSSZoom is exactly the feature that shipped with the new coordinate
 * behaviour, so its presence is a reliable proxy for which rule applies.
 * Absent it, the answer is 1 — do not fall back to reading the root's computed
 * zoom, which reports the scale on both and would divide on the wrong one.
 *
 * Verified against both behaviours before being written this way.
 */
export function zoomOf(element?: Element | null): number {
  if (typeof window === "undefined") return 1;

  const own = (element as (Element & { currentCSSZoom?: number }) | null | undefined)
    ?.currentCSSZoom;

  return typeof own === "number" && own > 0 ? own : 1;
}

/**
 * A trigger's box, already in the overlay's coordinate space. Structurally a
 * subset of DOMRect, so a raw rect still assigns to it — the name is what
 * signals which space a value is in as it moves between components.
 */
export type AnchorRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

/**
 * A trigger's box in the coordinate space of a fixed overlay inside the zoomed
 * root — i.e. what you can assign straight to `left` / `top`.
 */
export function toZoomed(rect: DOMRect, element?: Element | null): AnchorRect {
  const z = zoomOf(element);
  if (z === 1) return rect;

  return {
    left: rect.left / z,
    top: rect.top / z,
    right: rect.right / z,
    bottom: rect.bottom / z,
    width: rect.width / z,
    height: rect.height / z,
  };
}

/**
 * Window size in that same space, for clamping an overlay on screen.
 *
 * window.innerWidth/Height are screen pixels under both implementations, so
 * this division is unconditional — unlike toZoomed, which depends on which
 * space rects come back in.
 */
export function viewportSize(element?: Element | null): {
  width: number;
  height: number;
} {
  const z = rootZoom();
  return {
    width: window.innerWidth / z,
    height: window.innerHeight / z,
  };
}

/**
 * The root's scale, read from the cascade. Always the real factor, on both
 * implementations — which is what converting window dimensions needs, and
 * exactly what converting rects must not use.
 */
export function rootZoom(): number {
  if (typeof window === "undefined") return 1;
  const value = Number.parseFloat(
    window.getComputedStyle(document.documentElement).zoom || "1"
  );
  return Number.isFinite(value) && value > 0 ? value : 1;
}

/** Measure a trigger and its viewport together — the usual pairing. */
export function anchorOf(element: Element): AnchorRect & {
  viewportWidth: number;
  viewportHeight: number;
} {
  const rect = toZoomed(element.getBoundingClientRect(), element);
  const { width, height } = viewportSize(element);
  return { ...rect, viewportWidth: width, viewportHeight: height };
}
