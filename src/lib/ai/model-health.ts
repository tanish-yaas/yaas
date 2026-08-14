/**
 * A short memory of the primary model being unavailable.
 *
 * When Gemini reports the primary as overloaded it usually stays that way for
 * minutes, not milliseconds. Without this, every single request pays the cost
 * of discovering that again before switching to the fallback — which is small
 * per call but is paid on every parse and every dictation for the whole outage.
 *
 * In-process only, like the rate-limit buckets: a serverless instance that has
 * not seen a failure yet will try the primary once and find out, which is the
 * correct behaviour anyway. The cooldown is deliberately short so a recovered
 * model is picked back up quickly rather than being written off for the life of
 * the instance.
 */
const COOLDOWN_MS = 60_000;

let downUntil = 0;

export function markPrimaryDown(): void {
  downUntil = Date.now() + COOLDOWN_MS;
}

/** A success clears the cooldown early — no reason to keep avoiding it. */
export function markPrimaryUp(): void {
  downUntil = 0;
}

export function primaryIsDown(): boolean {
  return Date.now() < downUntil;
}
