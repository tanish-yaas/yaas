import { signIn } from "@/auth";
import { BrandLockup } from "@/components/layout/brand";
import { OrbitField } from "@/components/visual/orbit-field";

export default function LoginPage() {
  return (
    <main
      className="flex h-screen overflow-hidden"
      style={{
        backgroundImage:
          "linear-gradient(160deg, #1d1d22 0%, #17171a 34%, #121214 68%, #0c0c0e 100%)",
      }}
    >
      {/* Visual half */}
      <section className="relative hidden overflow-hidden border-r border-border lg:flex lg:w-1/2 lg:flex-col">
        <div className="aurora-panel opacity-80" aria-hidden />

        <div className="relative z-10 shrink-0 p-8">
          <BrandLockup size={52} subtitle="Workspace" />
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center p-4">
          <OrbitField className="h-full w-full" />
        </div>
      </section>

      {/* Sign-in half */}
      <section className="relative flex flex-1 flex-col justify-center overflow-y-auto px-6 py-8 sm:px-10 lg:w-1/2 lg:px-14">
        <div className="aurora-panel opacity-25 lg:opacity-[0.14]" aria-hidden />

        <div className="relative z-10 mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <BrandLockup size={44} />
          </div>

          <span className="nova-rise inline-flex items-center gap-2 rounded-full border border-brand-violet/40 bg-brand-violet/[0.1] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-violet">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-violet" />
            YAAS // Nova
          </span>

          <h1
            className="nova-rise mt-5 text-[clamp(1.75rem,3.4vw,2.75rem)] font-semibold leading-[1.1] tracking-tight"
            style={{ animationDelay: "60ms" }}
          >
            Everything your team owes each other,{" "}
            <span className="text-gradient">in one place.</span>
          </h1>

          <p
            className="nova-rise mt-4 text-[13px] leading-relaxed text-muted-foreground"
            style={{ animationDelay: "120ms" }}
          >
            Write what needs doing the way you&apos;d say it out loud. Nova turns
            it into a scheduled task, puts it on the right calendar, and reminds
            the right person before it slips.
          </p>

          <form
            className="nova-rise mt-7"
            style={{ animationDelay: "180ms" }}
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-lg bg-foreground text-[13px] font-medium text-background transition-all hover:opacity-90 active:scale-[0.99]"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
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
            className="nova-rise mt-3.5 text-[11px] leading-relaxed text-faint"
            style={{ animationDelay: "220ms" }}
          >
            One sign-in for your whole workspace. New here? Signing in puts you
            in the queue for an admin to approve.
          </p>
        </div>
      </section>
    </main>
  );
}