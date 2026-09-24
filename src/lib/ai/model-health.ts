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

/**
 * Run a model call under the policy the parser arrived at: the primary gets
 * the first attempt, unless it is already known to be down, and every attempt
 * after that is the fallback.
 *
 * The SDK's own retry re-tries the *same* model with exponential backoff,
 * which is the one thing that cannot help an overloaded one — measured at 7.5s
 * of waiting before it gave up. Callers pass maxRetries: 0 and let this
 * switch models instead, which is the part that actually helps.
 */
export async function withModelFallback<T>(
  models: { model: string; fallbackModel: string },
  run: (modelId: string) => Promise<T>,
  isTransient: (error: unknown) => boolean,
  attempt = 1
): Promise<T> {
  const usePrimary = attempt === 1 && !primaryIsDown();
  const modelId = usePrimary ? models.model : models.fallbackModel;

  try {
    const result = await run(modelId);
    if (usePrimary) markPrimaryUp();
    return result;
  } catch (error) {
    if (!isTransient(error) || attempt >= 3) throw error;

    if (usePrimary) {
      // Skip the primary for the next minute rather than rediscovering this on
      // every request for as long as the outage lasts.
      markPrimaryDown();
    } else {
      // Only wait when the next attempt is the same model again. Switching
      // models needs no cooling-off period — that is the whole point of it.
      await new Promise((r) => setTimeout(r, attempt * 500));
    }

    return withModelFallback(models, run, isTransient, attempt + 1);
  }
}
