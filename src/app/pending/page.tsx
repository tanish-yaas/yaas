import { signOut } from "@/auth";
import { getCurrentContext } from "@/server/auth/session";
import { redirect } from "next/navigation";

export default async function PendingPage() {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");
  if (ctx.membership?.status === "ACTIVE") redirect("/");

  return (
    <>
      <div className="aurora-bg" aria-hidden />

      <main className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="glass flex w-full max-w-md flex-col items-center gap-5 rounded-2xl px-10 py-12 text-center">
          <div className="rounded-full bg-brand-violet/15 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-brand-violet">
            Awaiting approval
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            You&apos;re on the list
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your request to join{" "}
            <span className="text-foreground">
              {ctx.membership?.organization.name ?? "the workspace"}
            </span>{" "}
            is with an admin. You&apos;ll get access as soon as they approve it.
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    </>
  );
}