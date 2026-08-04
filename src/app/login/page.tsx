import { signIn } from "@/auth";
import { BrandLockup } from "@/components/layout/brand";

/** Purely decorative: a slow orbital system that gives the page some life. */
function OrbitField() {
  const orbits = [
    { r: 190, tilt: -16, squash: 0.36, duration: "34s", dot: 4.5, color: "var(--brand-violet)" },
    { r: 144, tilt: 22, squash: 0.44, duration: "24s", dot: 4, color: "var(--brand-cyan)" },
    { r: 98, tilt: 64, squash: 0.5, duration: "16s", dot: 3.5, color: "var(--brand-magenta)" },
  ];

  return (
    <svg
      viewBox="0 0 440 440"
      aria-hidden
      className="h-full max-h-[560px] w-full max-w-[560px]"
    >
      <defs>
        <radialGradient id="nova-core-glow">
          <stop offset="0%" stopColor="var(--brand-violet)" stopOpacity="0.95" />
          <stop offset="45%" stopColor="var(--brand-violet)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--brand-violet)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Structural lines, echoing a blueprint */}
      <g stroke="currentColor" strokeWidth="1" className="text-white/[0.07]">
        <path d="M16 118 H108 V26" fill="none" />
        <path d="M424 322 H332 V414" fill="none" />
        <circle cx="108" cy="26" r="3" fill="currentColor" stroke="none" />
        <circle cx="332" cy="414" r="3" fill="currentColor" stroke="none" />
      </g>

      <g
        className="nova-float text-white/[0.06]"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      >
        <polygon points="112,96 95,125 61,125 44,96 61,67 95,67" />
      </g>
      <g
        className="nova-float text-white/[0.05]"
        style={{ animationDelay: "-3.5s" }}
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      >
        <polygon points="394,320 381,342 355,342 342,320 355,298 381,298" />
      </g>

      {orbits.map((orbit, i) => (
        <g
          key={orbit.r}
          transform={`translate(220 220) rotate(${orbit.tilt}) scale(1 ${orbit.squash})`}
        >
          <circle
            r={orbit.r}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className={i === 1 ? "nova-trace text-white/20" : "text-white/[0.11]"}
          />
          <g
            className="nova-orbit"
            style={{
              animationDuration: orbit.duration,
              animationDirection: i === 1 ? "reverse" : "normal",
            }}
          >
            <circle cx={orbit.r} cy="0" r={orbit.dot} fill={orbit.color} />
          </g>
        </g>
      ))}

      <circle cx="220" cy="220" r="96" fill="url(#nova-core-glow)" />
      <circle
        cx="220"
        cy="220"
        r="30"
        fill="none"
        stroke="var(--brand-violet)"
        strokeOpacity="0.4"
        className="nova-core"
      />
      <circle cx="220" cy="220" r="15" fill="var(--brand-violet)" />
      <circle cx="220" cy="220" r="6" fill="#fff" fillOpacity="0.9" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* Visual half */}
      <section className="relative hidden overflow-hidden border-r border-border/60 lg:flex lg:w-1/2 lg:flex-col">
        <div className="aurora-bg opacity-70" aria-hidden />

        <div className="relative z-10 p-9">
          <BrandLockup size={40} subtitle="Workspace" />
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center px-10 pb-16">
          <OrbitField />
        </div>
      </section>

      {/* Sign-in half */}
      <section className="relative flex flex-1 flex-col justify-center px-6 py-14 sm:px-10 lg:w-1/2 lg:px-16">
        <div className="aurora-bg opacity-40 lg:hidden" aria-hidden />

        <div className="relative z-10 mx-auto w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <BrandLockup size={40} />
          </div>

          <span className="nova-rise inline-flex items-center gap-2 rounded-full border border-brand-violet/30 bg-brand-violet/[0.08] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-brand-violet">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-violet" />
            YAAS · Nova
          </span>

          <h1
            className="nova-rise mt-6 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl"
            style={{ animationDelay: "60ms" }}
          >
            Everything your team
            <br />
            owes each other,
            <br />
            <span className="text-gradient">in one place.</span>
          </h1>

          <p
            className="nova-rise mt-5 text-sm leading-relaxed text-muted-foreground"
            style={{ animationDelay: "120ms" }}
          >
            Write what needs doing the way you&apos;d say it out loud. Nova turns
            it into a scheduled task, puts it on the right calendar, and reminds
            the right person before it slips.
          </p>

          <form
            className="nova-rise mt-9"
            style={{ animationDelay: "180ms" }}
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="group inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-foreground text-sm font-medium text-background transition-all hover:opacity-90 active:scale-[0.99]"
            >
              <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
                />
              </svg>
              Continue with Google
            </button>
          </form>

          <p
            className="nova-rise mt-4 text-xs leading-relaxed text-muted-foreground/70"
            style={{ animationDelay: "220ms" }}
          >
            One sign-in for your whole workspace — no extra password to
            remember. New here? Signing in puts you in the queue for an admin to
            approve.
          </p>
        </div>
      </section>
    </main>
  );
}
