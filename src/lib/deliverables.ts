/**
 * The deliverables report's shapes and formatting.
 *
 * Pure, and deliberately outside the server service: the toggle that marks
 * every row SF or LF re-writes the answer in the browser, with no second trip
 * to the model. Same functions on both sides, so what you copy is what the
 * server would have written.
 */

export type DeliverableKind = "LF" | "SF";

export type DeliverableRow = {
  ip: string;
  videoName: string;
  kind: DeliverableKind;
  /** YYYY-MM-DD, handled as a string the whole way — see formatDay. */
  start: string;
  end: string;
  status: "LIVE" | "WIP";
};

export type Period = { from: string; to: string };

/** What every row is marked as, regardless of what the sheet said. */
export type KindOverride = "auto" | "SF" | "LF";

export const KIND_OVERRIDES: { value: KindOverride; label: string }[] = [
  { value: "auto", label: "From the sheet" },
  { value: "SF", label: "All short form" },
  { value: "LF", label: "All long form" },
];

/** 2026-09-21 → 21/09/26, the form's format. Strings only: no Date, no zone. */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/** 2026-09-21 → 21/09/2026, for the sentence above the list. */
export function formatLongDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function applyOverride(
  rows: DeliverableRow[],
  override: KindOverride
): DeliverableRow[] {
  if (override === "auto") return rows;
  return rows.map((row) => ({ ...row, kind: override }));
}

function group(rows: DeliverableRow[]) {
  const byIp = new Map<string, DeliverableRow[]>();
  for (const row of rows) {
    const list = byIp.get(row.ip) ?? [];
    list.push(row);
    byIp.set(row.ip, list);
  }
  for (const list of byIp.values()) {
    list.sort(
      (a, b) =>
        a.start.localeCompare(b.start) || a.videoName.localeCompare(b.videoName)
    );
  }
  return byIp;
}

/** One line, exactly as the form wants it. */
function line(row: DeliverableRow) {
  return `IP Name- ${row.ip} , Video Name- ${row.videoName}, ${row.kind}, ${formatDay(row.start)} to ${formatDay(row.end)}`;
}

function blocks(rows: DeliverableRow[]) {
  return [...group(rows).entries()]
    .map(([ip, list]) => `${ip}\n\n${list.map(line).join("\n")}`)
    .join("\n\n");
}

export type ReportCounts = {
  total: number;
  longForm: number;
  shortForm: number;
  live: number;
  wip: number;
  upcoming: number;
  ips: number;
};

export type FormattedReport = {
  answerOne: string;
  answerTwo: string;
  counts: ReportCounts;
};

/**
 * The two answers. Counts that must add up and a format a form is pasted
 * into — neither is left to the model.
 */
export function formatReport(
  rows: { worked: DeliverableRow[]; upcoming: DeliverableRow[] },
  worked: Period,
  upcoming: Period
): FormattedReport {
  const counts: ReportCounts = {
    total: rows.worked.length,
    longForm: rows.worked.filter((r) => r.kind === "LF").length,
    shortForm: rows.worked.filter((r) => r.kind === "SF").length,
    live: rows.worked.filter((r) => r.status === "LIVE").length,
    wip: rows.worked.filter((r) => r.status === "WIP").length,
    upcoming: rows.upcoming.length,
    ips: group(rows.worked).size,
  };

  const summary =
    `${formatLongDay(worked.from)} to ${formatLongDay(worked.to)} — ${counts.total} ` +
    `${counts.total === 1 ? "deliverable" : "deliverables"}: ${counts.longForm} long form, ` +
    `${counts.shortForm} short form. ${counts.live} went live, ${counts.wip} still work in progress.`;

  const answerOne =
    counts.total === 0
      ? "No deliverables found in that period."
      : `${summary}\n\n${blocks(rows.worked)}`;

  const answerTwo =
    rows.upcoming.length === 0
      ? `Nothing scheduled in the sheets for ${formatLongDay(upcoming.from)} to ${formatLongDay(upcoming.to)}.`
      : `${formatLongDay(upcoming.from)} to ${formatLongDay(upcoming.to)} — ${rows.upcoming.length} planned.\n\n${blocks(rows.upcoming)}`;

  return { answerOne, answerTwo, counts };
}
