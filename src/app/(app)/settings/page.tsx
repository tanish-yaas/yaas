import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import { WhatsAppLink } from "@/components/settings/whatsapp-link";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { IdentitySettings } from "@/components/settings/identity-settings";
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
import { describeRRule } from "@/server/services/recurring";
import { formatIST } from "@/lib/dates";

export default async function SettingsPage() {
  const ctx = await getCurrentContext();
  if (!ctx?.profile) return null;

  const businessNumber =
    process.env.WHATSAPP_DISPLAY_NUMBER ?? "the YAAS number";
  const sandboxMode = process.env.WHATSAPP_SANDBOX !== "false";
  const slackReady = !!process.env.SLACK_BOT_TOKEN;

  const orgId = ctx.membership?.organizationId;

  const [schedules, labels, recurring, memberRows] = await Promise.all([
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

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-7">
        <h1 className="text-[26px] font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-[13px] text-faint">{ctx.profile.displayName}</p>
      </header>

      <div className="flex flex-col gap-4">
        <IdentitySettings
          displayName={ctx.profile.displayName ?? ""}
          jobTitle={ctx.profile.jobTitle ?? ""}
          bio={ctx.profile.bio ?? ""}
          avatarUrl={ctx.profile.avatarUrl ?? ""}
          signInImage={ctx.session.user.image ?? null}
        />

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
      </div>
    </div>
  );
}