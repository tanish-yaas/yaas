import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError, checkRate, requirePermission } from "@/server/rbac/guard";
import { LIMITS } from "@/lib/rate-limit";
import { istTodayKey } from "@/lib/dates";
import { parseReportFilters, reportSearch } from "@/lib/reports";
import { buildWorkReport, getReportAudience } from "@/server/services/reports";
import { renderReportPdf } from "@/server/reports/pdf";
import { renderReportXlsx } from "@/server/reports/xlsx";

// Reads the session and renders a fresh file every time.
export const dynamic = "force-dynamic";
// A year of a busy workspace renders in seconds, not the default's handful.
export const maxDuration = 60;

const FORMATS = {
  pdf: { type: "application/pdf", ext: "pdf" },
  xlsx: {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: "xlsx",
  },
} as const;

function plain(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * The Reports tab as a file. Takes the page's own query string plus
 * `format`, and runs the same parser and the same service, so what downloads
 * is what was on screen.
 *
 * A GET because a download is a read, but it still goes through
 * requirePermission like any action, and it leaves an audit row: a report is
 * a copy of the workspace's work leaving the building.
 */
export async function GET(request: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission("report.view_own");
  } catch (error) {
    if (error instanceof AuthError) return plain("You can't download reports here.", 403);
    throw error;
  }

  const format = request.nextUrl.searchParams.get("format");
  if (format !== "pdf" && format !== "xlsx") return plain("Unknown format.", 400);

  const userId = ctx.session.user.id;
  const rate = checkRate(
    userId,
    "report-export",
    LIMITS.reportExport.limit,
    LIMITS.reportExport.window
  );
  if (!rate.allowed) {
    return plain(
      `That's a lot of downloads in a row. Try again in ${rate.retryAfterSeconds}s.`,
      429
    );
  }

  const orgId = ctx.membership.organizationId;
  const filters = parseReportFilters(request.nextUrl.searchParams, istTodayKey());
  const viewer = { orgId, userId, permissions: ctx.permissions };

  const audience = await getReportAudience(viewer);
  const report = await buildWorkReport(viewer, filters, audience, {
    workspaceName: ctx.membership.organization.name,
    viewerName: ctx.profile?.displayName ?? ctx.session.user.name ?? "Someone",
  });

  const body =
    format === "pdf" ? await renderReportPdf(report) : await renderReportXlsx(report);

  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      actorId: userId,
      actorEmail: ctx.session.user.email ?? null,
      action: "EXPORT",
      entityType: "WorkReport",
      after: {
        format,
        from: filters.from,
        to: filters.to,
        query: reportSearch(filters),
        people: report.people.length,
        lines: report.entries.length,
        tasks: report.tasks.length,
      },
      userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
    },
  });

  const { type, ext } = FORMATS[format];
  const filename = `nova-work-report-${ctx.slug}-${filters.from}-to-${filters.to}.${ext}`;

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(body.length),
      "Cache-Control": "no-store",
    },
  });
}
