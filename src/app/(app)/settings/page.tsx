import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/server/auth/session";
import { WhatsAppLink } from "@/components/settings/whatsapp-link";
import { ProfileSettings } from "@/components/settings/profile-settings";
import {
  ReminderSettings,
  type ScheduleRow,
} from "@/components/settings/reminder-settings";

export default async function SettingsPage() {
  const ctx = await getCurrentContext();
  if (!ctx?.profile) return null;

  const businessNumber =
    process.env.WHATSAPP_DISPLAY_NUMBER ?? "your test number in Meta";

  const schedules = await prisma.reminderSchedule.findMany({
    where: { userId: ctx.session.user.id },
    orderBy: { type: "asc" },
  });

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
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ctx.profile.displayName}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <ProfileSettings
          workingHoursStart={ctx.profile.workingHoursStart}
          workingHoursEnd={ctx.profile.workingHoursEnd}
          workingDays={ctx.profile.workingDays}
        />

        {ctx.permissions.has("whatsapp.link") && (
          <WhatsAppLink
            linkedNumber={whatsappReady ? ctx.profile.whatsappNumber : null}
            businessNumber={businessNumber}
          />
        )}

        <ReminderSettings schedules={rows} whatsappReady={whatsappReady} />
      </div>
    </div>
  );
}