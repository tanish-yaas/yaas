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
        <div className="panel w-full max-w-sm px-8 py-10 text-center backdrop-blur-xl">
          <p className="text-[11px] uppercase tracking-[0.05em] text-primary">
            Awaiting approval
          </p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight">
            You&apos;re on the list
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Your request to join{" "}
            <span className="text-foreground">
              {ctx.membership?.organization.name ?? "the workspace"}
            </span>{" "}
            is with an admin.
          </p>
          <form
            className="mt-6"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-[12px] text-faint transition-colors hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </main>
    </>
  );
}