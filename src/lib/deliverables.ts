/**
 * The deliverables report's shapes, dates and formatting.
 *
 * Pure, and outside the server service on purpose: the toggle that marks every
 * row SF or LF re-writes the answer in the browser with no second trip to the
 * model, using the same functions the server would have used.
 *
 * Everything here is deliberately not the model's job. The first build asked
 * the model to decide which rows fell inside the reporting window, and against
 * real sheets it quietly dropped a whole month: 3 deliverables came back where
 * there were 26. Dates in these sheets are not ambiguous, so they are read and
 * compared here, and the model is left with the part that genuinely varies.
 */

export type DeliverableKind = "LF" | "SF";

export type DeliverableRow = {
  ip: string;
  videoName: string;
  kind: DeliverableKind;
  /** YYYY-MM-DD, handled as a string the whole way. See formatDay. */
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

/** 2026-09-21 becomes 21/09/26, the format the form wants. */
export function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

/** 2026-09-21 becomes 21/09/2026, for the sentence above the list. */
export function formatLongDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Every date in a line of a sheet, as ISO days.
 *
 * Day first, always: these are Indian marketing sheets and the app is pinned
 * to IST, so 03/09/2026 is the 3rd of September. Guessing per row would make
 * the same column mean two things in one file.
 */
export function datesIn(line: string): string[] {
  const out: string[] = [];

  for (const match of line.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)) {
    out.push(`${match[1]}-${match[2]}-${match[3]}`);
  }

  for (const match of line.matchAll(
    /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g
  )) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    if (day < 1 || day > 31 || month < 1 || month > 12) continue;
    out.push(
      `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    );
  }

  return out;
}

export function isValidDay(value: string): boolean {
  return ISO.test(value);
}

/** Inclusive on both ends, which is how the form's windows read. */
export function within(day: string, period: Period): boolean {
  return day >= period.from && day <= period.to;
}

/** A row belongs to a window if any of the work on it happened inside. */
export function overlaps(row: DeliverableRow, period: Period): boolean {
  return row.start <= period.to && row.end >= period.from;
}

/**
 * The IP name, from a file name or a workbook tab.
 *
 * The sheets are exports, so they arrive called things like "Influencer
 * Marketing Road Map - the.fincredibles (old).csv". The IP is the part after
 * the last dash, and "(old)" is the same IP as the file without it, which is
 * what makes one heading out of two files.
 */
export function ipNameFromSource(raw: string): string {
  let name = raw.trim().replace(/\.[a-z0-9]+$/i, "");

  const dash = name.lastIndexOf(" - ");
  if (dash !== -1) name = name.slice(dash + 3);

  // "(old)", "(new)", "(copy)", "(2)" — a version of the same sheet.
  name = name.replace(/\((?:old|new|copy|final|latest|\d+)\)/gi, "");
  name = name.replace(/\s+/g, " ").trim();

  // "the.fincredibles" is a handle, not a sentence: dots are spaces.
  if (name.includes(".") && !name.includes(" ")) {
    name = name.split(".").filter(Boolean).join(" ");
  }

  // Only title-case what arrived entirely lowercase. "ClearlyTripping" is
  // already the name they use.
  if (name && name === name.toLowerCase()) {
    name = name.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }

  return name || raw.trim();
}

export function applyOverride(
  rows: DeliverableRow[],
  override: KindOverride
): DeliverableRow[] {
  if (override === "auto") return rows;
  return rows.map((row) => ({ ...row, kind: override }));
}

/** Same video, same day, listed twice because two influencers carried it. */
export function dedupe(rows: DeliverableRow[]): DeliverableRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.ip}|${row.videoName.trim().toLowerCase()}|${row.start}|${row.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
 * The two answers. Counts that must add up, and a format that is pasted into
 * a form, so neither is left to the model.
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
    `${formatLongDay(worked.from)} to ${formatLongDay(worked.to)}: ${counts.total} ` +
    `${counts.total === 1 ? "deliverable" : "deliverables"}, ${counts.longForm} long form and ` +
    `${counts.shortForm} short form. ${counts.live} went live, ${counts.wip} still work in progress.`;

  const answerOne =
    counts.total === 0
      ? "No deliverables found in that period."
      : `${summary}\n\n${blocks(rows.worked)}`;

  const answerTwo =
    rows.upcoming.length === 0
      ? `Nothing scheduled in the sheets for ${formatLongDay(upcoming.from)} to ${formatLongDay(upcoming.to)}.`
      : `${formatLongDay(upcoming.from)} to ${formatLongDay(upcoming.to)}: ${rows.upcoming.length} planned.\n\n${blocks(rows.upcoming)}`;

  return { answerOne, answerTwo, counts };
}
