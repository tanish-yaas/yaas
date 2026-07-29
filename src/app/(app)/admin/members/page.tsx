import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import { approveMember, deactivateMember } from "@/server/actions/members";

export default async function MembersPage() {
  const ctx = await getCurrentContext();
  if (!ctx?.membership) return null;
  if (!ctx.permissions.has("member.approve")) redirect("/");

  const canDeactivate = ctx.permissions.has("member.deactivate");

  const members = await prisma.organizationMember.findMany({
    where: { organizationId: ctx.membership.organizationId },
    include: { user: true, role: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const pending = members.filter((m) => m.status === "PENDING");
  const active = members.filter((m) => m.status === "ACTIVE");
  const inactive = members.filter((m) => m.status === "DEACTIVATED");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Members
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {ctx.membership.organization.name}
      </p>

      <section className="mt-8">
        <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Pending · {pending.length}
        </h2>
        {pending.length === 0 ? (
          <p className="glass rounded-xl px-5 py-6 text-sm text-muted-foreground">
            No one waiting for approval.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((m) => (
              <li
                key={m.id}
                className="glass flex items-center justify-between gap-4 rounded-xl px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">{m.user.name ?? "Unnamed"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.user.email}
                  </p>
                </div>
                <form action={approveMember}>
                  <input type="hidden" name="memberId" value={m.id} />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Approve
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Active · {active.length}
        </h2>
        <ul className="flex flex-col gap-2">
          {active.map((m) => (
            <li
              key={m.id}
              className="glass flex items-center justify-between gap-4 rounded-xl px-5 py-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{m.user.name ?? "Unnamed"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.user.email}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-brand-violet/15 px-3 py-1 text-xs text-brand-violet">
                  {m.role.name}
                </span>
                {canDeactivate && m.userId !== ctx.session.user.id && (
                  <form action={deactivateMember}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <button
                      type="submit"
                      className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-destructive"
                    >
                      Deactivate
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {inactive.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Deactivated · {inactive.length}
          </h2>
          <ul className="flex flex-col gap-2">
            {inactive.map((m) => (
              <li
                key={m.id}
                className="glass flex items-center justify-between gap-4 rounded-xl px-5 py-4 opacity-60"
              >
                <p className="truncate text-sm">{m.user.email}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}