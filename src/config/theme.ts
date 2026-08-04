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
  /** Colours a label chip may take. Everything else in the UI is derived. */
  labelPalette: [
    "#7C5CFF",
    "#FF4D8F",
    "#22D3EE",
    "#F5B544",
    "#4ADE80",
    "#FF4D6D",
    "#A78BFA",
    "#94A3B8",
  ],
  motion: {
    duration: { fast: 0.15, base: 0.25, slow: 0.4 },
    ease: {
      out: [0.16, 1, 0.3, 1],
      inOut: [0.65, 0, 0.35, 1],
    },
  },
} as const;