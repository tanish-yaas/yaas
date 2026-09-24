"use server";

import { requirePermission, checkRate } from "@/server/rbac/guard";
import { LIMITS } from "@/lib/rate-limit";
import {
  extractDeliverables,
  formatReport,
  type FormattedReport,
} from "@/server/services/deliverables";

const MAX_FILES = 12;
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = [".csv", ".tsv", ".txt", ".xlsx", ".xlsm"];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type DeliverablesResult =
  | {
      ok: true;
      report: FormattedReport;
      notes: string[];
      sources: string[];
      truncated: boolean;
    }
  | { ok: false; error: string };

function period(formData: FormData, fromKey: string, toKey: string) {
  const from = String(formData.get(fromKey) ?? "");
  const to = String(formData.get(toKey) ?? "");
  if (!DATE.test(from) || !DATE.test(to)) return null;
  if (from > to) return null;
  return { from, to };
}

/**
 * Turn the month's tracking sheets into the two answers the deliverables form
 * asks for. Reads files and writes nothing — there is no report table, because
 * the output's whole life is being copied into a form once a month.
 */
export async function generateDeliverables(
  formData: FormData
): Promise<DeliverablesResult> {
  const ctx = await requirePermission("ai.use");

  const rate = checkRate(
    ctx.session.user.id,
    "ai-report",
    LIMITS.aiReport.limit,
    LIMITS.aiReport.window
  );
  if (!rate.allowed) {
    return {
      ok: false,
      error: `That's a few runs in a row — try again in ${rate.retryAfterSeconds}s.`,
    };
  }

  const worked = period(formData, "workedFrom", "workedTo");
  const upcoming = period(formData, "upcomingFrom", "upcomingTo");
  if (!worked) return { ok: false, error: "Check the first date range" };
  if (!upcoming) return { ok: false, error: "Check the second date range" };

  const uploads = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (uploads.length === 0) return { ok: false, error: "Add at least one file" };
  if (uploads.length > MAX_FILES) {
    return { ok: false, error: `That's more than ${MAX_FILES} files` };
  }

  for (const file of uploads) {
    const name = file.name.toLowerCase();
    if (!ACCEPTED.some((ext) => name.endsWith(ext))) {
      return {
        ok: false,
        error: `${file.name} isn't a CSV or Excel file`,
      };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, error: `${file.name} is larger than 8MB` };
    }
  }

  const files = await Promise.all(
    uploads.map(async (file) => ({
      name: file.name,
      buffer: await file.arrayBuffer(),
    }))
  );

  const extracted = await extractDeliverables({ files, worked, upcoming });
  if (!extracted.ok) return { ok: false, error: extracted.error };

  return {
    ok: true,
    report: formatReport(extracted.report, worked, upcoming),
    notes: extracted.report.notes,
    sources: extracted.report.sources,
    truncated: extracted.report.truncated,
  };
}
