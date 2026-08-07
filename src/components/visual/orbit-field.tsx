/**
 * Decorative orbital system.
 * variant="hero"     — full strength, login
 * variant="backdrop" — ghosted, behind app content
 */
export function OrbitField({
  variant = "hero",
  className = "",
}: {
  variant?: "hero" | "backdrop";
  className?: string;
}) {
  const backdrop = variant === "backdrop";
  const uid = backdrop ? "bd" : "hero";

  const rings = [
    { r: 212, tilt: -18, squash: 0.34, dur: "48s", dot: 5, hue: "var(--brand-violet)", dir: "normal" },
    { r: 168, tilt: 26, squash: 0.42, dur: "36s", dot: 4, hue: "var(--brand-cyan)", dir: "reverse" },
    { r: 124, tilt: 72, squash: 0.52, dur: "26s", dot: 4.5, hue: "var(--brand-magenta)", dir: "normal" },
    { r: 80, tilt: -46, squash: 0.6, dur: "18s", dot: 3.5, hue: "var(--brand-violet)", dir: "reverse" },
  ];

  /** Small nodes riding each orbit path at fixed offsets. */
  const nodes = [
    { ring: 0, angle: 128, size: 2.5 },
    { ring: 0, angle: 254, size: 2 },
    { ring: 1, angle: 62, size: 2.5 },
    { ring: 1, angle: 198, size: 2 },
    { ring: 1, angle: 310, size: 2.5 },
    { ring: 2, angle: 96, size: 2 },
    { ring: 2, angle: 232, size: 2.5 },
    { ring: 3, angle: 150, size: 2 },
  ];

  return (
    <svg
      viewBox="0 0 520 520"
      aria-hidden
      className={className}
      style={{ opacity: backdrop ? 0.14 : 1 }}
    >
      <defs>
        <radialGradient id={`${uid}-core`}>
          <stop offset="0%" stopColor="var(--brand-violet)" stopOpacity="0.9" />
          <stop offset="40%" stopColor="var(--brand-violet)" stopOpacity="0.26" />
          <stop offset="100%" stopColor="var(--brand-violet)" stopOpacity="0" />
        </radialGradient>

        <linearGradient id={`${uid}-arc`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-violet)" stopOpacity="0.6" />
          <stop offset="50%" stopColor="var(--brand-cyan)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--brand-magenta)" stopOpacity="0.55" />
        </linearGradient>

        <pattern id={`${uid}-grid`} width="52" height="52" patternUnits="userSpaceOnUse">
          <path
            d="M52 0 H0 V52"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-white/[0.045]"
          />
        </pattern>
      </defs>

      <rect width="520" height="520" fill={`url(#${uid}-grid)`} />

      <g stroke="currentColor" strokeWidth="1" className="text-white/[0.09]">
        <path d="M18 138 H128 V30" fill="none" />
        <path d="M502 382 H392 V490" fill="none" />
        <path d="M340 44 L400 104" fill="none" />
        <circle cx="128" cy="30" r="3.5" fill="currentColor" stroke="none" />
        <circle cx="392" cy="490" r="3.5" fill="currentColor" stroke="none" />
        <circle cx="400" cy="104" r="2.5" fill="currentColor" stroke="none" />
      </g>

      <g
        className="nova-float text-white/[0.08]"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      >
        <polygon points="118,112 100,144 64,144 46,112 64,80 100,80" />
      </g>
      <g
        className="nova-float text-white/[0.06]"
        style={{ animationDelay: "-4s" }}
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      >
        <polygon points="466,392 452,416 424,416 410,392 424,368 452,368" />
      </g>
      <g
        className="nova-float text-white/[0.05]"
        style={{ animationDelay: "-2s" }}
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      >
        <polygon points="436,148 426,166 406,166 396,148 406,130 426,130" />
      </g>

      {rings.map((ring, i) => (
        <g
          key={ring.r}
          transform={`translate(260 260) rotate(${ring.tilt}) scale(1 ${ring.squash})`}
        >
          <circle
            r={ring.r}
            fill="none"
            stroke={i === 1 ? `url(#${uid}-arc)` : "currentColor"}
            strokeWidth="1"
            strokeDasharray={i === 2 ? "3 9" : undefined}
            className={
              i === 1 ? "nova-trace" : i === 2 ? "text-white/[0.18]" : "text-white/[0.12]"
            }
          />

          {/* Static nodes sitting on the orbit line */}
          {nodes
            .filter((n) => n.ring === i)
            .map((n) => {
              const rad = (n.angle * Math.PI) / 180;
              return (
                <circle
                  key={n.angle}
                  cx={Math.cos(rad) * ring.r}
                  cy={Math.sin(rad) * ring.r}
                  r={n.size}
                  fill={ring.hue}
                  opacity="0.55"
                />
              );
            })}

          {/* Travelling body */}
          <g
            className="nova-orbit"
            style={{ animationDuration: ring.dur, animationDirection: ring.dir }}
          >
            <circle cx={ring.r} cy="0" r={ring.dot * 2.8} fill={ring.hue} opacity="0.14" />
            <circle cx={ring.r} cy="0" r={ring.dot} fill={ring.hue} />
          </g>
        </g>
      ))}

      <circle cx="260" cy="260" r="112" fill={`url(#${uid}-core)`} />
      <circle
        cx="260"
        cy="260"
        r="42"
        fill="none"
        stroke="var(--brand-violet)"
        strokeOpacity="0.3"
        className="nova-core"
      />
      <circle
        cx="260"
        cy="260"
        r="30"
        fill="none"
        stroke="var(--brand-violet)"
        strokeOpacity="0.45"
        className="nova-core"
        style={{ animationDelay: "-1.6s" }}
      />
      <circle cx="260" cy="260" r="16" fill="var(--brand-violet)" />
      <circle cx="260" cy="260" r="6.5" fill="#fff" fillOpacity="0.92" />
    </svg>
  );
}