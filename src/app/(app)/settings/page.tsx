import { getCurrentContext } from "@/server/auth/session";
import { WhatsAppLink } from "@/components/settings/whatsapp-link";

export default async function SettingsPage() {
  const ctx = await getCurrentContext();
  if (!ctx?.profile) return null;

  const businessNumber =
    process.env.WHATSAPP_DISPLAY_NUMBER ?? "your test number in Meta";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ctx.profile.displayName} · {ctx.profile.timezone}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {ctx.permissions.has("whatsapp.link") && (
          <WhatsAppLink
            linkedNumber={
              ctx.profile.whatsappVerified ? ctx.profile.whatsappNumber : null
            }
            businessNumber={businessNumber}
          />
        )}
      </div>
    </div>
  );
}