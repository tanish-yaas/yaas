export const APP_CONFIG = {
  /** Single workspace timezone. Everyone works from one place. */
  timezone: "Asia/Kolkata",
  locale: "en-IN",
  /** Used when a date is given with no time. */
  defaultDueHour: 17,
  /** A diary page is a day's thinking, not a document. Both sides enforce these. */
  diary: {
    maxPoints: 60,
    maxPointChars: 500,
  },
} as const;