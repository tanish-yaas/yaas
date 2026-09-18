export const APP_CONFIG = {
  /**
   * The clock the product runs on, for every workspace.
   *
   * Not per-workspace, despite OrganizationSettings.defaultTimezone existing:
   * day boundaries are baked into the dashboard, the diary, the digests and
   * the recurring scheduler, and making them tenant-relative is its own piece
   * of work. A workspace outside IST will see days start at the wrong hour —
   * that is a known limit, not an oversight.
   */
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