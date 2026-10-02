import { redirect } from "next/navigation";
import { getCurrentContext } from "@/server/auth/session";
import { wsPath } from "@/server/workspace/paths";
import { istTodayKey } from "@/lib/dates";
import { newestWholeDays, parseReportFilters } from "@/lib/reports";
import { buildWorkReport, getReportAudience } from "@/server/services/reports";
import { ReportScreen } from "@/components/reports/report-screen";

export const metadata = { title: "Reports" };

/**
 * Daily log lines sent to the browser. A month of a busy team is well under
 * it; a year is not, and twenty megabytes of RSC payload is a page that never
 * loads. Past it the screen keeps the newest days and says so, and the
 * downloads, which read the same query, still have every line.
 */
const SCREEN_LINES = 2000;

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ workspace }, query] = await Promise.all([params, searchParams]);
  const ctx = await getCurrentContext();
  if (!ctx?.membership || !ctx.profile) return null;
  if (!ctx.permissions.has("report.view_own")) redirect(wsPath(workspace));

  const userId = ctx.session.user.id;
  const viewer = {
    orgId: ctx.membership.organizationId,
    userId,
    permissions: ctx.permissions,
  };

  const todayKey = istTodayKey();
  const filters = parseReportFilters(query, todayKey);
  const audience = await getReportAudience(viewer);
  const report = await buildWorkReport(viewer, filters, audience, {
    workspaceName: ctx.membership.organization.name,
    viewerName: ctx.profile.displayName ?? ctx.session.user.name ?? "You",
  });

  const shown = newestWholeDays(report.entries, SCREEN_LINES);

  return (
    <ReportScreen
      // The raw event list only feeds the spreadsheet.
      report={{ ...report, entries: shown, events: [] }}
      hiddenLines={report.entries.length - shown.length}
      todayKey={todayKey}
      selfId={userId}
      audience={{
        people: audience.people,
        teams: audience.teams,
        labels: audience.labels,
        canSeeOthers: audience.canSeeOthers,
      }}
    />
  );
}
