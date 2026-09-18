import { redirect } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listMemberships } from "@/server/auth/session";
import { wsPath } from "@/server/workspace/paths";

/**
 * Waiting on one workspace. Which one is in the query string, because a user
 * can be a member of three workspaces and pending on a fourth — this page is
 * about that fourth, and the others stay reachable from the link at the
 * bottom rather than being hidden behind a sign-out.
 */
export default async function PendingPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { w } = await searchParams;
  const memberships = await listMemberships(session.user.id);

  const waiting = w
    ? memberships.find(
        (m) => m.organization.slug === w && m.status === "PENDING"
      )
    : memberships.find((m) => m.status === "PENDING");

  // Approved while the tab sat open, or never pending in the first place.
  if (!waiting) {
    const org = w
      ? memberships.find((m) => m.organization.slug === w)
      : undefined;
    redirect(org ? wsPath(org.organization.slug) : "/");
  }

  const elsewhere = memberships.filter(
    (m) => m.status === "ACTIVE" && m.organizationId !== waiting.organizationId
  );

  const admins = await prisma.organizationMember.count({
    where: {
      organizationId: waiting.organizationId,
      status: "ACTIVE",
      role: { permissions: { some: { permission: { key: "member.approve" } } } },
    },
  });

  return (
    <>
      <div className="aurora-bg" aria-hidden />

      <main className="relative z-10 flex min-h-full items-center justify-center px-6">
        <div className="panel w-full max-w-sm px-8 py-10 text-center backdrop-blur-xl">
          <p className="text-[11px] uppercase tracking-[0.05em] text-primary">
            Awaiting approval
          </p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight">
            You&apos;re on the list
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Your request to join{" "}
            <span className="text-foreground">{waiting.organization.name}</span>{" "}
            is with {admins === 1 ? "its admin" : `its ${admins} admins`}.
          </p>

          {/* The way out of waiting, not just a way to wait harder. Someone who
              was sent a code after asking should not have to sign out to use
              it. */}
          <Link
            href="/welcome/join"
            className="mt-6 inline-flex h-9 w-full items-center justify-center rounded-lg border border-border text-[12px] transition-colors hover:border-brand-violet/40"
          >
            Have an invite code?
          </Link>

          {elsewhere.length > 0 && (
            <div className="mt-6 border-t border-border pt-5 text-left">
              <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-faint">
                Meanwhile
              </p>
              {elsewhere.map((m) => (
                <Link
                  key={m.id}
                  href={wsPath(m.organization.slug)}
                  className="row gap-2 rounded-lg px-2 text-[13px] transition-colors hover:bg-[var(--card-hover)]"
                >
                  <span className="truncate">{m.organization.name}</span>
                </Link>
              ))}
            </div>
          )}

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
