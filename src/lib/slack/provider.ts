import crypto from "crypto";
import { SLACK_IDENTITY } from "@/config/slack";

export type SlackSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string };

const API = "https://slack.com/api";

/**
 * How the bot presents itself on every message. Requires the
 * chat:write.customize scope; without it Slack ignores both fields and falls
 * back to whatever the app config says, so this is safe to always send.
 */
function identity(): Record<string, string> {
  const out: Record<string, string> = { username: SLACK_IDENTITY.name };
  if (SLACK_IDENTITY.iconUrl) out.icon_url = SLACK_IDENTITY.iconUrl;
  return out;
}

/**
 * Slack signs every request with a versioned HMAC over the raw body. The
 * timestamp check is what stops a captured request being replayed later.
 */
export function verifySlackSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !signature || !timestamp) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) return false;

  const expected =
    "v0=" +
    crypto
      .createHmac("sha256", secret)
      .update(`v0:${timestamp}:${rawBody}`, "utf8")
      .digest("hex");

  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

async function call<T>(
  method: string,
  body: Record<string, unknown>
): Promise<T & { ok: boolean; error?: string }> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "SLACK_BOT_TOKEN not configured" } as T & {
      ok: boolean;
      error?: string;
    };
  }

  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  return response.json();
}

/** Resolve a Slack user ID from an email address. */
export async function findSlackUserByEmail(
  email: string
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { ok: false, error: "Slack is not configured" };

  const url = `${API}/users.lookupByEmail?email=${encodeURIComponent(email)}`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      user?: { id: string; deleted?: boolean; is_bot?: boolean };
    };

    if (!data.ok || !data.user) {
      return {
        ok: false,
        error:
          data.error === "users_not_found"
            ? "No Slack account with that email in this workspace"
            : data.error ?? "Lookup failed",
      };
    }

    if (data.user.deleted || data.user.is_bot) {
      return { ok: false, error: "That Slack account is inactive" };
    }

    return { ok: true, userId: data.user.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/** Send a direct message to a Slack user ID. */
export async function sendSlackDM(
  slackUserId: string,
  text: string
): Promise<SlackSendResult> {
  try {
    const data = await call<{ ts?: string; channel?: string }>(
      "chat.postMessage",
      {
        channel: slackUserId,
        text,
        unfurl_links: false,
        unfurl_media: false,
        ...identity(),
      }
    );

    if (!data.ok) {
      return { ok: false, error: data.error ?? "Send failed" };
    }

    return { ok: true, providerMessageId: data.ts ?? "unknown" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Post into whatever conversation a message came from — DM, channel or thread.
 * `threadTs` keeps replies attached to the message that triggered them.
 */
export async function postSlackMessage(
  channel: string,
  text: string,
  threadTs?: string
): Promise<SlackSendResult> {
  try {
    const data = await call<{ ts?: string }>("chat.postMessage", {
      channel,
      text,
      unfurl_links: false,
      unfurl_media: false,
      ...(threadTs ? { thread_ts: threadTs } : {}),
      ...identity(),
    });

    if (!data.ok) return { ok: false, error: data.error ?? "Send failed" };
    return { ok: true, providerMessageId: data.ts ?? "unknown" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/** The email on a Slack account, used to match it to a Nova user. */
export async function getSlackUserEmail(
  slackUserId: string
): Promise<string | null> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;

  try {
    const response = await fetch(
      `${API}/users.info?user=${encodeURIComponent(slackUserId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = (await response.json()) as {
      ok: boolean;
      user?: { profile?: { email?: string } };
    };

    return data.ok ? data.user?.profile?.email ?? null : null;
  } catch {
    return null;
  }
}

/** Convenience: look up by email then DM, in one call. */
export async function sendSlackToEmail(
  email: string,
  text: string
): Promise<SlackSendResult> {
  const lookup = await findSlackUserByEmail(email);
  if (!lookup.ok) return { ok: false, error: lookup.error };
  return sendSlackDM(lookup.userId, text);
}

export function slackConfigured(): boolean {
  return !!process.env.SLACK_BOT_TOKEN;
}