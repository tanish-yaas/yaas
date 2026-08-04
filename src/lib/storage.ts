/**
 * Supabase Storage over its REST API — no extra SDK, just the service-role key
 * on the server. Every call returns a discriminated result rather than throwing
 * so actions can surface a message instead of an error page.
 */

const BUCKET = "attachments";
const MAX_BYTES = 10 * 1024 * 1024;

type Ok<T> = { ok: true } & T;
type Err = { ok: false; error: string };

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function isStorageConfigured(): boolean {
  return config() !== null;
}

export const ATTACHMENT_BUCKET = BUCKET;
export const MAX_ATTACHMENT_BYTES = MAX_BYTES;

function headers(key: string, extra: Record<string, string> = {}) {
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
    ...extra,
  };
}

/** Create the private bucket on first use. Safe to call repeatedly. */
async function ensureBucket(url: string, key: string): Promise<string | null> {
  const existing = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, {
    headers: headers(key),
    cache: "no-store",
  });

  if (existing.ok) return null;

  const created = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: headers(key, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: false,
      file_size_limit: MAX_BYTES,
    }),
  });

  // A parallel upload may have won the race — that's still a success.
  if (created.ok || created.status === 409) return null;

  return `Could not create the "${BUCKET}" bucket (${created.status})`;
}

export async function uploadAttachment(
  storageKey: string,
  bytes: ArrayBuffer,
  contentType: string
): Promise<Ok<{ storageKey: string }> | Err> {
  const cfg = config();
  if (!cfg) return { ok: false, error: "File storage isn't configured yet" };

  const bucketError = await ensureBucket(cfg.url, cfg.key);
  if (bucketError) return { ok: false, error: bucketError };

  const response = await fetch(
    `${cfg.url}/storage/v1/object/${BUCKET}/${storageKey}`,
    {
      method: "POST",
      headers: headers(cfg.key, {
        "Content-Type": contentType || "application/octet-stream",
        "x-upsert": "true",
      }),
      body: bytes,
    }
  );

  if (!response.ok) {
    return { ok: false, error: `Upload failed (${response.status})` };
  }

  return { ok: true, storageKey };
}

/** Short-lived download link for a private object. */
export async function signedUrl(
  storageKey: string,
  expiresInSeconds = 60 * 5
): Promise<Ok<{ url: string }> | Err> {
  const cfg = config();
  if (!cfg) return { ok: false, error: "File storage isn't configured yet" };

  const response = await fetch(
    `${cfg.url}/storage/v1/object/sign/${BUCKET}/${storageKey}`,
    {
      method: "POST",
      headers: headers(cfg.key, { "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    return { ok: false, error: `Could not build a link (${response.status})` };
  }

  const data = (await response.json()) as { signedURL?: string };
  if (!data.signedURL) return { ok: false, error: "Storage returned no link" };

  return { ok: true, url: `${cfg.url}/storage/v1${data.signedURL}` };
}

export async function removeObject(storageKey: string): Promise<void> {
  const cfg = config();
  if (!cfg) return;

  await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${storageKey}`, {
    method: "DELETE",
    headers: headers(cfg.key),
  }).catch(() => undefined);
}
