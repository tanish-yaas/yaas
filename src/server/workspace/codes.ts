import { randomInt } from "node:crypto";

/**
 * Invite codes.
 *
 * These get read off a screen, typed into a phone, and pasted into WhatsApp,
 * so the alphabet leaves out the characters that do not survive that trip:
 * no O/0, no I/1/L, no U (which turns up in words nobody wants to generate).
 * 28 characters over 12 places is ~57 bits — a code is not guessable, and the
 * unique index is the backstop if two ever collide.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const LENGTH = 12;

/** What the user sees: NOVA-7K2P-XM4T-9BRC. Storage keeps only the 12 chars. */
export function formatCode(code: string) {
  return `NOVA-${code.match(/.{1,4}/g)?.join("-") ?? code}`;
}

export function generateCode() {
  let out = "";
  // randomInt, not Math.random: this is the whole of the access check.
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/**
 * Accept every reasonable spelling of the same code — with dashes or without,
 * with or without the NOVA prefix, lowercase. Returns null when what is left
 * is not code-shaped, which lets the caller say "that code isn't valid"
 * without a database round-trip.
 *
 * Lookalikes are not repaired. O, 0, I, 1, L and U are absent from the
 * alphabet by construction, so a code containing one was misread rather than
 * mistyped and there is no character to map it back to — guessing would turn
 * a clear error into a wrong answer.
 */
export function normaliseCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^NOVA/, "");

  if (cleaned.length !== LENGTH) return null;
  for (const char of cleaned) if (!ALPHABET.includes(char)) return null;
  return cleaned;
}
