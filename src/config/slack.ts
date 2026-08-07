/**
 * How Nova appears in Slack.
 *
 * The name and icon here only override per-message presentation, and only when
 * the app holds the chat:write.customize scope. The app's own display name and
 * default avatar still come from the Slack app configuration at api.slack.com —
 * set them there too, or the app's profile card will disagree with its messages.
 */
export const SLACK_IDENTITY = {
  name: process.env.SLACK_BOT_NAME ?? "Nova",

  /**
   * Absolute URL — Slack fetches it, so a relative path will not work. Point it
   * at the deployed avatar, e.g. https://your-domain/nova-avatar.png
   */
  iconUrl: process.env.SLACK_BOT_ICON_URL ?? "",
} as const;

/** Trailing hint appended to the bot's first reply of a conversation. */
export const SLACK_HELP =
  'Ask me anything about your work, or just tell me what needs doing and I\'ll add it. End with "?" to ask rather than add.';
