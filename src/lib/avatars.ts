/**
 * Avatar identifiers and validation, kept apart from the component that draws
 * them so the server action that validates a submitted value does not have to
 * import JSX — and does not break the day the component becomes a client one.
 *
 * Profile.avatarUrl holds one of:
 *   "avatar:<key>"  a built-in space avatar
 *   null            fall back to the sign-in photo, then to the initial
 *
 * Anything else is treated as a plain image URL, so adding uploads later means
 * writing that URL rather than reworking the call sites.
 */

export const AVATAR_PREFIX = "avatar:";

export type SpaceAvatar = {
  key: string;
  label: string;
  /** [background from, background to, mark] */
  colors: [string, string, string];
};

export const SPACE_AVATARS: SpaceAvatar[] = [
  { key: "nebula", label: "Nebula", colors: ["#7C5CFF", "#2B1B5A", "#C4B5FD"] },
  { key: "saturn", label: "Saturn", colors: ["#F5B544", "#7A4B12", "#FFE6B0"] },
  { key: "pulsar", label: "Pulsar", colors: ["#22D3EE", "#0E4A57", "#CFFAFE"] },
  { key: "comet", label: "Comet", colors: ["#FF4D8F", "#5A1030", "#FFD3E4"] },
  { key: "eclipse", label: "Eclipse", colors: ["#8B8B94", "#1C1C22", "#F4F4F5"] },
  { key: "quasar", label: "Quasar", colors: ["#4ADE80", "#0F3D25", "#D9F9E4"] },
  { key: "orbit", label: "Orbit", colors: ["#A78BFA", "#2E1F5E", "#EDE9FE"] },
  { key: "aurora", label: "Aurora", colors: ["#FB7185", "#5A1A2A", "#FFE0E5"] },
];

export const AVATAR_BY_KEY = new Map(SPACE_AVATARS.map((a) => [a.key, a]));

/** The avatar key if the value names a built-in, otherwise null. */
export function avatarKeyOf(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl?.startsWith(AVATAR_PREFIX)) return null;
  const key = avatarUrl.slice(AVATAR_PREFIX.length);
  return AVATAR_BY_KEY.has(key) ? key : null;
}
