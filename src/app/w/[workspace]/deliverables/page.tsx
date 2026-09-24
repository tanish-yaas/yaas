import { redirect } from "next/navigation";
import { getCurrentContext } from "@/server/auth/session";
import { wsPath } from "@/server/workspace/paths";
import { istTodayKey } from "@/lib/dates";
import {
  DeliverablesPanel,
  type MonthOption,
} from "@/components/deliverables/deliverables-panel";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The last 15 months, newest first. Day-key maths, so no timezone gets in. */
function recentMonths(todayKey: string): MonthOption[] {
  const [year, month] = todayKey.split("-").map(Number);
  const out: MonthOption[] = [];

  for (let back = 0; back < 15; back++) {
    const index = month - 1 - back;
    const y = year + Math.floor(index / 12);
    const m = ((index % 12) + 12) % 12;
    out.push({
      value: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: `${MONTH_NAMES[m]} ${y}`,
    });
  }

  return out;
}

export default async function DeliverablesPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const ctx = await getCurrentContext();
  if (!ctx?.membership) return null;

  // The whole page is one model call behind a button.
  if (!ctx.permissions.has("ai.use")) redirect(wsPath(workspace));

  const months = recentMonths(istTodayKey());

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-7">
        <h1 className="text-[26px] font-semibold tracking-tight">
          Deliverables
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-faint">
          Drop in the month&apos;s tracking sheets and get both answers the
          deliverables form asks for, in the format it wants.
        </p>
      </header>

      <DeliverablesPanel months={months} defaultMonth={months[0].value} />
    </div>
  );
}
