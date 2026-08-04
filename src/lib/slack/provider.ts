export type SlackSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string };

const API = "https://slack.com/api";

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