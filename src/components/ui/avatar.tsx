import {
  AVATAR_BY_KEY,
  AVATAR_PREFIX,
  SPACE_AVATARS,
  avatarKeyOf,
} from "@/lib/avatars";

export { AVATAR_PREFIX, SPACE_AVATARS };

/** The glyph that distinguishes each avatar, drawn over its gradient. */
function Mark({ shape, color }: { shape: string; color: string }) {
  if (shape === "saturn") {
    return (
      <g stroke={color} fill="none" strokeWidth="3">
        <circle cx="32" cy="32" r="11" fill={color} stroke="none" />
        <ellipse cx="32" cy="32" rx="22" ry="7" transform="rotate(-20 32 32)" />
      </g>
    );
  }
  if (shape === "pulsar") {
    return (
      <g stroke={color} fill="none" strokeWidth="2.5">
        <circle cx="32" cy="32" r="6" fill={color} stroke="none" />
        <circle cx="32" cy="32" r="13" opacity="0.7" />
        <circle cx="32" cy="32" r="20" opacity="0.35" />
      </g>
    );
  }
  if (shape === "comet") {
    return (
      <g fill={color}>
        <circle cx="40" cy="24" r="7" />
        <path d="M36 29 L14 48 L20 34 Z" opacity="0.75" />
      </g>
    );
  }
  if (shape === "eclipse") {
    return (
      <g>
        <circle cx="32" cy="32" r="15" fill={color} />
        <circle cx="25" cy="28" r="13" fill="#111114" />
      </g>
    );
  }
  if (shape === "quasar") {
    return (
      <g fill={color}>
        <circle cx="32" cy="32" r="5" />
        <path d="M32 6 L36 26 L32 32 L28 26 Z" opacity="0.8" />
        <path d="M32 58 L28 38 L32 32 L36 38 Z" opacity="0.8" />
      </g>
    );
  }
  if (shape === "orbit") {
    return (
      <g stroke={color} fill="none" strokeWidth="2.5">
        <circle cx="32" cy="32" r="7" fill={color} stroke="none" />
        <ellipse cx="32" cy="32" rx="21" ry="9" transform="rotate(28 32 32)" />
        <circle cx="50" cy="24" r="4" fill={color} stroke="none" />
      </g>
    );
  }
  if (shape === "aurora") {
    return (
      <g stroke={color} fill="none" strokeWidth="3" strokeLinecap="round">
        <path d="M14 40 Q24 20 32 34 Q40 48 50 26" opacity="0.9" />
        <path d="M14 50 Q24 32 32 44 Q40 56 50 38" opacity="0.5" />
      </g>
    );
  }
  // nebula
  return (
    <g fill={color}>
      <circle cx="26" cy="28" r="10" opacity="0.85" />
      <circle cx="40" cy="38" r="7" opacity="0.6" />
      <circle cx="42" cy="22" r="3.5" opacity="0.9" />
      <circle cx="20" cy="44" r="2.5" opacity="0.7" />
    </g>
  );
}

export function SpaceAvatarMark({
  avatarKey,
  size = 32,
}: {
  avatarKey: string;
  size?: number;
}) {
  const avatar = AVATAR_BY_KEY.get(avatarKey) ?? SPACE_AVATARS[0];
  const [from, to, mark] = avatar.colors;
  const gradientId = `av-${avatar.key}`;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden
      className="shrink-0 rounded-full"
    >
      <defs>
        <radialGradient id={gradientId} cx="35%" cy="28%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="32" fill={`url(#${gradientId})`} />
      <Mark shape={avatar.key} color={mark} />
    </svg>
  );
}

/**
 * One avatar, wherever a person is shown. Resolves the stored preference down
 * to a space avatar, an image, or the initial.
 */
export function Avatar({
  avatarUrl,
  image,
  name,
  size = 32,
}: {
  avatarUrl?: string | null;
  image?: string | null;
  name?: string | null;
  size?: number;
}) {
  const key = avatarKeyOf(avatarUrl);
  if (key) return <SpaceAvatarMark avatarKey={key} size={size} />;

  const src = avatarUrl && !avatarUrl.startsWith(AVATAR_PREFIX) ? avatarUrl : image;

  if (src) {
    return (
      // Plain img: these are remote hosts (Google, later storage) and next/image
      // would need each one allow-listed in next.config for no real gain here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--primary)_22%,transparent)] font-medium text-foreground"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {(name ?? "?").charAt(0).toUpperCase()}
    </span>
  );
}
