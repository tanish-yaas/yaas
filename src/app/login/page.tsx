import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <>
      <div className="aurora-bg" aria-hidden />

      <main className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="glass flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl px-10 py-12 text-center">
          <h1 className="text-gradient font-display text-4xl font-semibold tracking-tight">
            YAAS
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your workspace
          </p>
          <form
            className="w-full"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Continue with Google
            </button>
          </form>
        </div>
      </main>
    </>
  );
}