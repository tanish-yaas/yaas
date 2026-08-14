/**
 * Model-side failures that are worth retrying, and worth falling back to the
 * secondary model for.
 *
 * This started as a rate-limit test, which quietly cost us the fallback for a
 * whole class of failure: Gemini answers an overloaded model with "This model
 * is currently experiencing high demand", which matches nothing about quotas.
 * The parser saw a message it did not recognise, treated it as permanent, and
 * gave up — while the fallback model sat there answering fine. Every parse
 * failed for as long as the primary was busy.
 *
 * So the rule is deliberately broad. A false positive costs one extra call to
 * a cheaper model; a false negative costs the whole feature.
 */
const TRANSIENT =
  /\b(429|500|502|503|504)\b|quota|rate.?limit|resource.?exhausted|high demand|overload|unavailable|try again|temporarily|timed? ?out|deadline|ECONNRESET|ETIMEDOUT|fetch failed/i;

export function isTransientModelError(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return TRANSIENT.test(message);
}
