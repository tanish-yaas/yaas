"use client";

import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ACTIVITY_HINTS,
  ACTIVITY_KINDS,
  ACTIVITY_LABELS,
  dayHeading,
  formatMinutes,
  periodLabel,
  type ActivityKind,
  type LogEntry,
  type ReportGroup,
  type ReportPerson,
} from "@/lib/reports";
import {
  KIND_COLOR,
  KIND_ICON,
  LabelChips,
  PriorityTag,
  StatusTag,
} from "./report-bits";

/** Lines drawn before "Show all". A year of a busy team is a lot of DOM. */
const FIRST_PAINT = 400;

/** Which icon a line wears: the most telling thing that happened on it. */
const KIND_RANK: ActivityKind[] = [
  "completed",
  "progress",
  "added",
  "comment",
  "meeting",
  "ongoing",
];

function leadKind(entry: LogEntry): ActivityKind {
  const kinds = new Set(entry.activities.map((a) => a.kind));
  return KIND_RANK.find((k) => kinds.has(k)) ?? "ongoing";
}

type Group = {
  key: string;
  entries: LogEntry[];
  subgroups: { key: string; entries: LogEntry[] }[];
};

export function DailyLog({
  entries,
  people,
  from,
  to,
  hiddenLines,
  group,
  kinds,
  onKinds,
  onGroup,
  onOpenTask,
}: {
  entries: LogEntry[];
  people: ReportPerson[];
  from: string;
  to: string;
  hiddenLines: number;
  group: ReportGroup;
  kinds: ActivityKind[];
  onKinds: (next: ActivityKind[]) => void;
  onGroup: (next: ReportGroup) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const [limit, setLimit] = useState(FIRST_PAINT);
  const byPerson = new Map(people.map((p) => [p.userId, p]));

  const groups = useMemo<Group[]>(() => {
    const outerKey = (e: LogEntry) => (group === "day" ? e.dayKey : e.userId);
    const innerKey = (e: LogEntry) => (group === "day" ? e.userId : e.dayKey);

    const outer = new Map<string, LogEntry[]>();
    for (const e of entries.slice(0, limit)) {
      const k = outerKey(e);
      const list = outer.get(k) ?? [];
      list.push(e);
      outer.set(k, list);
    }

    const order =
      group === "day"
        ? [...outer.keys()]
        : people.map((p) => p.userId).filter((id) => outer.has(id));

    return order.map((key) => {
      const list = outer.get(key)!;
      if (group === "person") list.sort((a, b) => a.dayKey.localeCompare(b.dayKey));
      const inner = new Map<string, LogEntry[]>();
      for (const e of list) {
        const k = innerKey(e);
        const sub = inner.get(k) ?? [];
        sub.push(e);
        inner.set(k, sub);
      }
      return {
        key,
        entries: list,
        subgroups: [...inner.entries()].map(([k, v]) => ({ key: k, entries: v })),
      };
    });
  }, [entries, group, limit, people]);

  const toggleKind = (kind: ActivityKind) => {
    const on = kinds.includes(kind);
    // At least one kind stays on: an empty log is not a filter, it is a blank page.
    if (on && kinds.length === 1) return;
    onKinds(on ? kinds.filter((k) => k !== kind) : [...kinds, kind]);
  };

  const personLabel = (id: string) => {
    const p = byPerson.get(id);
    return (
      <span className="flex min-w-0 items-center gap-2">
        <Avatar avatarUrl={p?.avatarUrl} image={p?.image} name={p?.name} size={20} />
        <span className="truncate text-[13px] font-medium">{p?.name ?? "Member"}</span>
      </span>
    );
  };

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {ACTIVITY_KINDS.map((kind) => {
            const Icon = KIND_ICON[kind];
            const on = kinds.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                data-on={on}
                aria-pressed={on}
                title={ACTIVITY_HINTS[kind]}
                onClick={() => toggleKind(kind)}
                className="pill pill-sm"
              >
                <Icon size={12} style={{ color: on ? KIND_COLOR[kind] : undefined }} />
                {ACTIVITY_LABELS[kind]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Group the log">
          <span className="mr-1 text-[11px] text-faint">Group by</span>
          {(["day", "person"] as const).map((g) => (
            <button
              key={g}
              type="button"
              data-on={group === g}
              aria-pressed={group === g}
              onClick={() => onGroup(g)}
              className="pill pill-sm"
            >
              {g === "day" ? "Day" : "Person"}
            </button>
          ))}
        </div>
      </div>

      {hiddenLines > 0 && entries.length > 0 && (
        <p className="mb-3 rounded-xl border border-[color-mix(in_oklab,white_9%,transparent)] px-3 py-2 text-[12px] text-muted-foreground">
          This range has {(entries.length + hiddenLines).toLocaleString("en-IN")} lines, too many
          to draw at once. Showing the newest, from {dayHeading(entries[0].dayKey)}. The PDF and
          Excel downloads have the whole range.
        </p>
      )}

      {entries.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={ClipboardList}
            title="Nothing logged in this period"
            description={`Nobody in this report moved a task, commented, added work or sat in a meeting between ${periodLabel(from, to)}${kinds.length < ACTIVITY_KINDS.length ? " that matches the kinds picked above" : ""}.`}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => {
            const peopleCount = new Set(g.entries.map((e) => e.userId)).size;
            const daysCount = new Set(g.entries.map((e) => e.dayKey)).size;
            return (
              <article key={g.key} className="panel overflow-hidden">
                <header className="flex items-center justify-between gap-3 border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-2.5">
                  {group === "day" ? (
                    <h3 className="text-[13px] font-semibold tabular-nums">{dayHeading(g.key)}</h3>
                  ) : (
                    personLabel(g.key)
                  )}
                  <span className="shrink-0 text-[11px] tabular-nums text-faint">
                    {g.entries.length} {g.entries.length === 1 ? "line" : "lines"} ·{" "}
                    {group === "day"
                      ? `${peopleCount} ${peopleCount === 1 ? "person" : "people"}`
                      : `${daysCount} ${daysCount === 1 ? "day" : "days"}`}
                  </span>
                </header>

                {g.subgroups.map((sg) => (
                  <div
                    key={sg.key}
                    className="flex flex-col border-t border-[color-mix(in_oklab,white_6%,transparent)] first-of-type:border-t-0 sm:flex-row"
                  >
                    <div className="shrink-0 px-4 pb-1 pt-2.5 sm:w-48 sm:pb-2.5">
                      {group === "day" ? (
                        personLabel(sg.key)
                      ) : (
                        <span className="text-[12px] font-medium tabular-nums text-muted-foreground">
                          {dayHeading(sg.key)}
                        </span>
                      )}
                    </div>
                    <ul className="min-w-0 flex-1">
                      {sg.entries.map((e) => (
                        <EntryRow key={e.id} entry={e} onOpenTask={onOpenTask} />
                      ))}
                    </ul>
                  </div>
                ))}
              </article>
            );
          })}

          {entries.length > limit && (
            <button
              type="button"
              onClick={() => setLimit(entries.length)}
              className="pill pill-sm self-center"
            >
              Show all {entries.length} lines
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function EntryRow({
  entry,
  onOpenTask,
}: {
  entry: LogEntry;
  onOpenTask: (taskId: string) => void;
}) {
  const kind = leadKind(entry);
  const Icon = KIND_ICON[kind];
  const quiet = entry.activities.every((a) => a.kind === "ongoing");

  return (
    <li
      className="flex items-start gap-3 px-4 py-2 transition-colors hover:bg-[color-mix(in_oklab,white_3%,transparent)] sm:pl-0"
      style={{ opacity: quiet ? 0.72 : 1 }}
    >
      <Icon size={14} className="mt-0.5 shrink-0" style={{ color: KIND_COLOR[kind] }} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {entry.taskId ? (
            <button
              type="button"
              onClick={() => onOpenTask(entry.taskId!)}
              className="min-w-0 text-left text-[13px] leading-snug decoration-[color-mix(in_oklab,white_30%,transparent)] underline-offset-2 hover:underline"
            >
              {entry.title}
            </button>
          ) : (
            <span className="text-[13px] leading-snug">{entry.title}</span>
          )}
          {entry.parentTitle && (
            <span className="text-[11px] text-faint">in {entry.parentTitle}</span>
          )}
        </div>

        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
          {entry.type === "meeting" ? (
            <span className="tabular-nums">
              {entry.timeRange}
              {entry.minutes ? ` · ${formatMinutes(entry.minutes)}` : ""}
            </span>
          ) : (
            entry.activities.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                <span className="dot" style={{ backgroundColor: KIND_COLOR[a.kind] }} />
                {a.label}
                {a.time && <span className="tabular-nums text-faint">{a.time}</span>}
              </span>
            ))
          )}
        </div>
      </div>

      {entry.type === "task" && (
        <div className="hidden shrink-0 items-center justify-end gap-3 pt-0.5 md:flex">
          <LabelChips labels={entry.labels} />
          {entry.priority && <PriorityTag priority={entry.priority} />}
          {entry.status && (
            <span className="w-[86px]">
              <StatusTag status={entry.status} />
            </span>
          )}
        </div>
      )}
    </li>
  );
}
