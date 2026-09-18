import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import { approveMember, deactivateMember } from "@/server/actions/members";
import {
  TeamManager,
  type TeamRow,
} from "@/components/teams/team-manager";
import { RoleSelect } from "@/components/members/role-select";
import {
  InviteCodes,
  type InviteRow,
} from "@/components/members/invite-codes";
import { formatCode } from "@/server/workspace/codes";
import { wsPath } from "@/server/workspace/paths";
import { formatIST } from "@/lib/dates";
import { headers } from "next/headers";

function SectionPanel({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="panel mt-4 overflow-hidden">
      <div className="border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-2.5">
        <h2 className="text-[11px] uppercase tracking-[0.12em] text-faint">
          {title}
          <span className="ml-1.5 tabular-nums">{count}</span>
        </h2>
      </div>
      {children}
    </section>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-[13px] text-muted-foreground">{title}</p>
      <p className="mt-1 text-[12px] text-faint">{hint}</p>
    </div>
  );
}

const separator = "border-t border-[color-mix(in_oklab,white_6%,transparent)]";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const ctx = await getCurrentContext();
  if (!ctx?.membership) return null;
  if (!ctx.permissions.has("member.approve")) redirect(wsPath(workspace));

  const canDeactivate = ctx.permissions.has("member.deactivate");
  const canAssignRole = ctx.permissions.has("member.assign_role");
  const orgId = ctx.membership.organizationId;

  const canInvite = ctx.permissions.has("member.invite");

  const [members, teams, invites] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: { user: true, role: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.team.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { name: "asc" },
      include: {
        members: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
        },
        _count: { select: { tasks: true } },
      },
    }),
    canInvite
      ? prisma.organizationInvite.findMany({
          where: { organizationId: orgId, revokedAt: null },
          include: { role: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      : Promise.resolve([]),
  ]);

  const now = new Date();

  const inviteRows: InviteRow[] = invites.map((invite) => ({
    id: invite.id,
    code: formatCode(invite.code),
    label: invite.label,
    roleName: invite.role.name,
    email: invite.email,
    maxUses: invite.maxUses,
    useCount: invite.useCount,
    expiresLabel: invite.expiresAt
      ? formatIST(invite.expiresAt, { day: "numeric", month: "short" })
      : null,
    expired: !!invite.expiresAt && invite.expiresAt < now,
    spent: invite.maxUses !== null && invite.useCount >= invite.maxUses,
  }));

  // The origin the admin is actually looking at, so a copied link works from
  // a preview deployment and from localhost, not only from the canonical host.
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const joinUrlBase = host ? `${protocol}://${host}` : "";

  const teamRows: TeamRow[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color ?? "#7C5CFF",
    taskCount: t._count.tasks,
    members: t.members.map((m) => ({
      userId: m.userId,
      name: m.user.name ?? m.user.email ?? "Member",
      role: m.role,
    })),
  }));

  const pending = members.filter((m) => m.status === "PENDING");
  const active = members.filter((m) => m.status === "ACTIVE");
  const inactive = members.filter((m) => m.status === "DEACTIVATED");

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-7">
        <h1 className="text-[26px] font-semibold tracking-tight">Members</h1>
        <p className="mt-1 text-[13px] text-faint">
          {ctx.membership.organization.name}
        </p>
      </header>

      <SectionPanel title="Pending" count={pending.length}>
        {pending.length === 0 ? (
          <Empty
            title="No one waiting for approval"
            hint="People who ask to join by handle land here. An invite code skips the queue."
          />
        ) : (
          <ul>
            {pending.map((m, i) => (
              <li key={m.id} className={`row gap-3 ${i > 0 ? separator : ""}`}>
                <span className="truncate text-[13px]">
                  {m.user.name ?? "Unnamed"}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-faint">
                  {m.user.email}
                </span>
                <form action={approveMember} className="shrink-0">
                  <input type="hidden" name="memberId" value={m.id} />
                  <button
                    type="submit"
                    className="inline-flex h-7 items-center rounded-full bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Approve
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>

      {canInvite && (
        <InviteCodes
          invites={inviteRows}
          canGrantAdmin={canAssignRole}
          joinUrlBase={joinUrlBase}
        />
      )}

      <SectionPanel title="Active" count={active.length}>
        {active.length === 0 ? (
          <Empty
            title="No active members yet"
            hint="Approved members show up here with their role."
          />
        ) : (
          <ul>
            {active.map((m, i) => (
              <li key={m.id} className={`row gap-3 ${i > 0 ? separator : ""}`}>
                <span className="truncate text-[13px]">
                  {m.user.name ?? "Unnamed"}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-faint">
                  {m.user.email}
                </span>
                {canAssignRole && m.userId !== ctx.session.user.id ? (
                  <RoleSelect memberId={m.id} roleKey={m.role.key} />
                ) : (
                  <span className="chip chip-accent shrink-0">
                    {m.role.name}
                  </span>
                )}
                {canDeactivate && m.userId !== ctx.session.user.id && (
                  <form action={deactivateMember} className="shrink-0">
                    <input type="hidden" name="memberId" value={m.id} />
                    <button
                      type="submit"
                      className="hover-action hover-action--danger text-[12px]"
                    >
                      Deactivate
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>

      {(ctx.permissions.has("team.view") ||
        ctx.permissions.has("team.manage")) && (
        <TeamManager
          teams={teamRows}
          members={active.map((m) => ({
            userId: m.userId,
            name: m.user.name ?? m.user.email ?? "Member",
          }))}
          canCreate={ctx.permissions.has("team.create")}
          canManage={ctx.permissions.has("team.manage")}
        />
      )}

      {inactive.length > 0 && (
        <SectionPanel title="Deactivated" count={inactive.length}>
          <ul>
            {inactive.map((m, i) => (
              <li
                key={m.id}
                className={`row gap-3 opacity-60 ${i > 0 ? separator : ""}`}
              >
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                  {m.user.email}
                </span>
              </li>
            ))}
          </ul>
        </SectionPanel>
      )}
    </div>
  );
}