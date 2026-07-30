import { redirect } from "next/navigation";
import { getCurrentContext } from "@/server/auth/session";
import { completeOnboarding } from "@/server/actions/onboarding";
import { TIMEZONES, TIMEZONE_REGIONS, offsetLabel } from "@/lib/timezones";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const inputClass =
  "w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand-violet";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const ctx = await getCurrentContext();

  if (!ctx) redirect("/login");
  if (!ctx.membership || ctx.membership.status === "PENDING") redirect("/pending");
  if (ctx.membership.status === "DEACTIVATED") redirect("/login");
  if (ctx.profile) redirect("/");

  return (
    <main className="aurora flex min-h-screen items-center justify-center px-6 py-16">
      <div className="glass w-full max-w-lg rounded-2xl px-8 py-10">
        <div className="mb-8 text-center">
          <h1 className="text-gradient font-display text-3xl font-semibold tracking-tight">
            Set up your workspace
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This shapes your calendar, reminders, and how YAAS schedules work
            around you.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form action={completeOnboarding} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="displayName"
              className="text-xs font-medium text-muted-foreground"
            >
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              defaultValue={ctx.session.user.name ?? ""}
              required
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="jobTitle"
              className="text-xs font-medium text-muted-foreground"
            >
              Job title <span className="opacity-60">(optional)</span>
            </label>
            <input
              id="jobTitle"
              name="jobTitle"
              placeholder="Product Designer"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="whatsappNumber"
              className="text-xs font-medium text-muted-foreground"
            >
              WhatsApp number <span className="opacity-60">(optional)</span>
            </label>
            <input
              id="whatsappNumber"
              name="whatsappNumber"
              placeholder="+919876543210"
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground/70">
              International format with country code. You can link this later in
              Settings instead.
            </p>
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-3">
            <input
              type="checkbox"
              name="whatsappOptIn"
              className="mt-0.5 h-4 w-4 accent-[#7C5CFF]"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              Send me briefings and reminders on WhatsApp. You can turn this off
              any time in settings.
            </span>
          </label>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="timezone"
              className="text-xs font-medium text-muted-foreground"
            >
              Timezone
            </label>
            <select
              id="timezone"
              name="timezone"
              defaultValue="Asia/Kolkata"
              className={inputClass}
            >
              {TIMEZONE_REGIONS.map((region) => {
                const options = TIMEZONES.filter((t) => t.region === region);
                if (options.length === 0) return null;
                return (
                  <optgroup key={region} label={region}>
                    {options.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label} · {offsetLabel(t.value)}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="workingHoursStart"
                className="text-xs font-medium text-muted-foreground"
              >
                Day starts
              </label>
              <select
                id="workingHoursStart"
                name="workingHoursStart"
                defaultValue={9}
                className={inputClass}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="workingHoursEnd"
                className="text-xs font-medium text-muted-foreground"
              >
                Day ends
              </label>
              <select
                id="workingHoursEnd"
                name="workingHoursEnd"
                defaultValue={18}
                className={inputClass}
              >
                {Array.from({ length: 24 }, (_, i) => i + 1).map((i) => (
                  <option key={i} value={i}>
                    {String(i).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Working days
            </span>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <label
                  key={day.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs"
                >
                  <input
                    type="checkbox"
                    name="workingDays"
                    value={day.value}
                    defaultChecked={day.value >= 1 && day.value <= 5}
                    className="h-3.5 w-3.5 accent-[#7C5CFF]"
                  />
                  {day.label}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 inline-flex h-11 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Finish setup
          </button>
        </form>
      </div>
    </main>
  );
}