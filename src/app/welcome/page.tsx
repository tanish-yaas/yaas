import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, KeyRound, ChevronRight } from "lucide-react";
import { auth, signOut } from "@/auth";
import { listMemberships } from "@/server/auth/session";
import { wsPath } from "@/server/workspace/paths";
import { WelcomeFrame } from "@/components/workspace/welcome-frame";

/**
 * The fork in the road, and the only screen a brand-new account sees.
 *
 * Signing in used to put you straight into whichever workspace existed first,
 * which worked exactly as long as there was only one. Now the two ways in are
 * a question, asked once.
 */
export default async function WelcomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const memberships = await listMemberships(session.user.id);
  const firstName = session.user.name?.split(" ")[0];

  return (
    <WelcomeFrame
      eyebrow={memberships.length > 0 ? "New workspace" : "Welcome to Nova"}
      title={firstName ? `Hi ${firstName}` : "Let's get you set up"}
      blurb="A workspace is one team's tasks, calendar and notes. Start one, or join the one you were invited to."
      footer={
        memberships.length === 0 ? (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="transition-colors hover:text-foreground">
              Sign out
            </button>
          </form>
        ) : null
      }
    >
      <div className="flex flex-col gap-2.5">
        <Choice
          href="/welcome/create"
          icon={<Plus size={16} />}
          title="Create a workspace"
          detail="For your team. You'll be its admin."
        />
        <Choice
          href="/welcome/join"
          icon={<KeyRound size={16} />}
          title="Join with an invite code"
          detail="Someone on the team sent you one."
        />
      </div>

      {/* Someone who already has workspaces reached this page on purpose — from
          the switcher — so it has to be possible to change their mind. */}
      {memberships.length > 0 && (
        <div className="mt-7 border-t border-border pt-5">
          <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-faint">
            Your workspaces
          </p>
          <div className="flex flex-col">
            {memberships.map((m) => (
              <Link
                key={m.id}
                href={
                  m.status === "PENDING"
                    ? `/pending?w=${m.organization.slug}`
                    : wsPath(m.organization.slug)
                }
                className="row gap-2 rounded-lg px-2 text-[13px] transition-colors hover:bg-[var(--card-hover)]"
              >
                <span className="min-w-0 flex-1 truncate">
                  {m.organization.name}
                </span>
                {m.status === "PENDING" && (
                  <span className="chip shrink-0">Pending</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </WelcomeFrame>
  );
}

function Choice({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3.5 rounded-xl border border-border bg-secondary/40 px-4 py-3.5 transition-colors hover:border-brand-violet/40 hover:bg-[var(--card-hover)]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium">{title}</span>
        <span className="mt-0.5 block text-[12px] text-faint">{detail}</span>
      </span>
      <ChevronRight
        size={15}
        className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
