export const theme = {
  brand: {
    violet: "#7C5CFF",
    magenta: "#FF4D8F",
    cyan: "#22D3EE",
  },
  gradient: {
    primary: "linear-gradient(100deg, #7C5CFF, #FF4D8F)",
  },
  priority: {
    URGENT: "#FF4D6D",
    HIGH: "#F5B544",
    MEDIUM: "#22D3EE",
    LOW: "#8B8B9E",
  },
  /**
   * Colours a label chip may take. Eight distinct hues at mid saturation, each
   * one still legible once .label-chip mixes it down to an 18% fill on the dark
   * background. Everything else in the UI is derived.
   */
  labelPalette: [
    "#E05561", // red
    "#E08A45", // orange
    "#D4B93C", // yellow
    "#4CAF6D", // green
    "#35B0AE", // teal
    "#4A90D9", // blue
    "#9B6DF3", // violet
    "#DE5DA8", // pink
  ],
  /**
   * Sticky-note hues for diary pages. Brighter and warmer than the label
   * palette — a note is meant to catch the eye — and each one is used as a tint
   * over the card surface rather than a fill, so a page pops without turning
   * into a flat yellow rectangle stuck to a dark room.
   */
  diaryPalette: [
    "#F5B544", // amber
    "#FF7A6B", // coral
    "#FF6F91", // rose
    "#9B6DF3", // violet
    "#22D3EE", // cyan
    "#4CC38A", // mint
  ],
  motion: {
    duration: { fast: 0.15, base: 0.25, slow: 0.4 },
    ease: {
      out: [0.16, 1, 0.3, 1],
      inOut: [0.65, 0, 0.35, 1],
    },
  },
} as const;