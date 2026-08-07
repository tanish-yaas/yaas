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
  motion: {
    duration: { fast: 0.15, base: 0.25, slow: 0.4 },
    ease: {
      out: [0.16, 1, 0.3, 1],
      inOut: [0.65, 0, 0.35, 1],
    },
  },
} as const;