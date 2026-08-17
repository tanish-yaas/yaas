type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Prevent unbounded growth on long-lived serverless instances. */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfterSeconds: 0,
  };
}

export const LIMITS = {
  aiParse: { limit: 20, window: 60 },
  // Tighter than parsing: every call ships up to a few MB of audio, and a
  // dictated note is one recording rather than something you retry in a burst.
  aiTranscribe: { limit: 10, window: 60 },
  aiChat: { limit: 15, window: 60 },
  search: { limit: 60, window: 60 },
  mutation: { limit: 60, window: 60 },
  // The diary autosaves while you type, so it needs more headroom than a
  // deliberate mutation — a debounced page still lands a few times a minute.
  diarySave: { limit: 180, window: 60 },
  webhook: { limit: 120, window: 60 },
} as const;