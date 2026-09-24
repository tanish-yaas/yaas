import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import { WhatsAppLink } from "@/components/settings/whatsapp-link";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { IdentitySettings } from "@/components/settings/identity-settings";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { getUiScale } from "@/server/services/ui-scale";
import {
  ReminderSettings,
  type ScheduleRow,
} from "@/components/settings/reminder-settings";
import {
  LabelSettings,
  type LabelRow,
} from "@/components/settings/label-settings";
import {
  RecurringSettings,
  type RecurringRow,
} from "@/components/settings/recurring-settings";
import { WorkspaceSettings } from "@/components/settings/workspace-settings";
import { DangerZone } from "@/components/settings/danger-zone";
import { describeRRule } from "@/server/services/recurring";
import { formatIST } from "@/lib/dates";
import { formatCode } from "@/server/workspace/codes";
import { findWorkspaceCode } from "@/server/workspace/invites";
import { accountDeletionSummary } from "@/server/account/deletion";
import { requestOrigin } from "@/server/workspace/origin";
import { wsPath } from "@/server/workspace/paths";

export default async function SettingsPage() {
  const ctx = await getCurrentContext();
  if (!ctx?.profile) return null;

  const businessNumber =
    process.env.WHATSAPP_DISPLAY_NUMBER ?? "the YAAS number";
  const sandboxMode = process.env.WHATSAPP_SANDBOX !== "false";
  const slackReady = !!process.env.SLACK_BOT_TOKEN;

  const orgId = ctx.membership?.organizationId;
  const canInvite = !!orgId && ctx.permissions.has("member.invite");
  const isOwner =
    !!ctx.membership &&
    ctx.membership.organization.ownerId === ctx.session.user.id;

  // What deleting would take with it, for the owner's confirmation dialog.
  // Counted here, in the same batch as everything else, rather than when the
  // dialog opens — that would be a round trip between the click and the text.
  const deletionCounts =
    isOwner && orgId
      ? Promise.all([
          prisma.task.count({ where: { organizationId: orgId, deletedAt: null } }),
          prisma.calendarEvent.count({
            where: { organizationId: orgId, deletedAt: null },
          }),
          prisma.attachment.count({
            where: { organizationId: orgId, deletedAt: null },
          }),
        ])
      : Promise.resolve(null);

  const [
    uiScale,
    schedules,
    labels,
    recurring,
    memberRows,
    orgSettings,
    workspaceCode,
    counts,
    origin,
    deletion,
    owner,
  ] = await Promise.all([
    getUiScale(),
    prisma.reminderSchedule.findMany({
      where: { userId: ctx.session.user.id },
      orderBy: { type: "asc" },
    }),
    orgId
      ? prisma.label.findMany({
          where: { organizationId: orgId },
          orderBy: { name: "asc" },
          include: { _count: { select: { tasks: true } } },
        })
      : Promise.resolve([]),
    orgId
      ? prisma.recurringTask.findMany({
          where: { organizationId: orgId, deletedAt: null },
          orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        })
      : Promise.resolve([]),
    orgId
      ? prisma.organizationMember.findMany({
          where: { organizationId: orgId, status: "ACTIVE" },
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    orgId
      ? prisma.organizationSettings.findUnique({
          where: { organizationId: orgId },
          select: { allowSelfSignup: true },
        })
      : Promise.resolve(null),
    canInvite ? findWorkspaceCode(orgId) : Promise.resolve(null),
    deletionCounts,
    canInvite ? requestOrigin() : Promise.resolve(""),
    // Everyone can delete their own account, so this is read on every visit.
    accountDeletionSummary(ctx.session.user.id),
    // In the batch rather than after it: it only needs the owner's id, which
    // the membership already carries, and waiting on the rest first cost a
    // whole extra round trip on every visit.
    ctx.membership
      ? prisma.user.findUnique({
          where: { id: ctx.membership.organization.ownerId },
          select: {
            name: true,
            email: true,
            profile: { select: { displayName: true } },
          },
        })
      : Promise.resolve(null),
    ]);

  const canManageAnyLabel = ctx.permissions.has("org.settings");

  const labelRows: LabelRow[] = labels.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
    taskCount: l._count.tasks,
    canManage: canManageAnyLabel || l.createdById === ctx.session.user.id,
  }));

  const canEditAnyTask = ctx.permissions.has("task.edit_any");

  const recurringRows: RecurringRow[] = recurring.map((r) => ({
    id: r.id,
    title: r.title,
    summary: describeRRule(r.rrule),
    nextRunAt: formatIST(r.nextRunAt, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    runCount: r.runCount,
    isActive: r.isActive,
    canManage: canEditAnyTask || r.ownerId === ctx.session.user.id,
  }));

  const members = memberRows.map((m) => ({
    userId: m.userId,
    name: m.user.name ?? m.user.email ?? "Member",
  }));

  const rows: ScheduleRow[] = schedules.map((s) => ({
    id: s.id,
    type: s.type,
    timeOfDay: s.timeOfDay,
    channel: s.channel,
    isActive: s.isActive,
    nextSendAt: s.nextSendAt?.toISOString() ?? null,
  }));

  const whatsappReady =
    ctx.profile.whatsappVerified && !!ctx.profile.whatsappNumber;

  const ownerName =
    owner?.profile?.displayName ?? owner?.name ?? owner?.email ?? "an admin";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-7">
        <h1 className="text-[26px] font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-[13px] text-faint">{ctx.profile.displayName}</p>
      </header>

      <div className="flex flex-col gap-4">
        {ctx.membership && (
          <WorkspaceSettings
            name={ctx.membership.organization.name}
            handle={ctx.membership.organization.slug}
            allowRequests={orgSettings?.allowSelfSignup ?? false}
            memberCount={memberRows.length}
            canEdit={ctx.permissions.has("org.settings")}
            canLeave={ctx.membership.organization.ownerId !== ctx.session.user.id}
            ownerName={ownerName}
            canInvite={canInvite}
            invite={
              workspaceCode
                ? {
                    id: workspaceCode.id,
                    code: formatCode(workspaceCode.code),
                    useCount: workspaceCode.useCount,
                    createdLabel: formatIST(workspaceCode.createdAt, {
                      day: "numeric",
                      month: "short",
                    }),
                  }
                : null
            }
            joinUrlBase={origin}
            membersHref={
              ctx.permissions.has("member.approve")
                ? wsPath(ctx.membership.organization.slug, "/admin/members")
                : null
            }
          />
        )}

        <IdentitySettings
          displayName={ctx.profile.displayName ?? ""}
          jobTitle={ctx.profile.jobTitle ?? ""}
          bio={ctx.profile.bio ?? ""}
          avatarUrl={ctx.profile.avatarUrl ?? ""}
          signInImage={ctx.session.user.image ?? null}
        />

        <AppearanceSettings value={uiScale} />

        <ProfileSettings
          workingHoursStart={ctx.profile.workingHoursStart}
          workingHoursEnd={ctx.profile.workingHoursEnd}
          workingDays={ctx.profile.workingDays}
        />

        <ReminderSettings
          schedules={rows}
          whatsappReady={whatsappReady}
          slackReady={slackReady}
        />

        {ctx.permissions.has("task.create") && (
          <>
            <RecurringSettings
              rows={recurringRows}
              members={members}
              labels={labelRows.map((l) => ({
                id: l.id,
                name: l.name,
                color: l.color,
              }))}
              currentUserId={ctx.session.user.id}
            />
            <LabelSettings labels={labelRows} />
          </>
        )}

        {ctx.permissions.has("whatsapp.link") && (
          <WhatsAppLink
            linkedNumber={whatsappReady ? ctx.profile.whatsappNumber : null}
            businessNumber={businessNumber}
            sandboxMode={sandboxMode}
          />
        )}

        {/* Last — the same place GitHub and Vercel keep theirs, as far from
            the everyday controls as it can get. The workspace row is the
            owner's alone; the account row is everyone's. */}
        <DangerZone
          workspace={
            ctx.membership && isOwner && counts
              ? {
                  name: ctx.membership.organization.name,
                  taskCount: counts[0],
                  eventCount: counts[1],
                  fileCount: counts[2],
                  otherMemberCount: Math.max(0, memberRows.length - 1),
                }
              : null
          }
          account={{
            email: ctx.session.user.email ?? "",
            soloOwned: deletion.soloOwned.map((w) => ({
              name: w.name,
              slug: w.slug,
            })),
            sharedOwned: deletion.sharedOwned.map((w) => ({
              name: w.name,
              slug: w.slug,
              otherMembers: w.otherMembers,
            })),
            memberOf: deletion.memberOf.map((w) => ({
              name: w.name,
              slug: w.slug,
            })),
          }}
        />
      </div>
    </div>
  );
}