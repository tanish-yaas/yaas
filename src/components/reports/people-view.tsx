"use client";

import { Users } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  WEEKDAYS,
  dayHeading,
  formatMinutes,
  weekdayOf,
  type PersonSummary,
  type ReportPerson,
} from "@/lib/reports";

/** Past two months the grid stops being readable as days. */
const GRID_MAX_DAYS = 62;

/**
 * One hue, brighter with more done, against the dark surface: a sequential
 * scale, so more always reads as more. The count is printed in the cell too,
 * so nothing rests on telling two violets apart.
 */
function cellStyle(count: number): React.CSSProperties {
  if (count === 0) return {};
  const strength = count >= 7 ? 85 : count >= 4 ? 62 : count >= 2 ? 40 : 22;
  return {
    backgroundColor: `color-mix(in oklab, var(--primary) ${strength}%, transparent)`,
    borderColor: "transparent",
    color: strength >= 62 ? "#fff" : "var(--foreground)",
  };
}

const LEGEND = [1, 2, 4, 7];

export function PeopleView({
  people,
  summaries,
  days,
  onPickPerson,
  onPickDay,
}: {
  people: ReportPerson[];
  summaries: PersonSummary[];
  days: string[];
  onPickPerson: (userId: string) => void;
  onPickDay: (userId: string, dayKey: string) => void;
}) {
  if (summaries.length === 0) {
    return (
      <div className="panel">
        <EmptyState
          icon={Users}
          title="Nobody to report on"
          description="No one you can see matches these filters. Try everyone, or another team."
        />
      </div>
    );
  }

  const byId = new Map(people.map((p) => [p.userId, p]));
  const showGrid = days.length <= GRID_MAX_DAYS;

  return (
    <div className="flex flex-col gap-3">
      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="border-b border-[color-mix(in_oklab,white_7%,transparent)] text-left text-[10px] uppercase tracking-[0.1em] text-faint">
              <th className="px-4 py-2.5 font-medium">Person</th>
              {[
                ["Completed", "Tasks assigned to them, marked done in the period"],
                ["On time", "Of those with a due date, done on or before that day"],
                ["Started", "Moved into In progress in the period"],
                ["Added", "Tasks they created"],
                ["Comments", "Comments they wrote"],
                ["Meetings", "Timed calendar events they were in, and the time in them"],
                ["Active days", "Days with anything done, not counting ongoing work"],
                ["Open now", "Assigned to them and not done, as of now"],
                ["Overdue now", "Open and past due, as of now"],
              ].map(([label, hint]) => (
                <th key={label} title={hint} className="px-3 py-2.5 text-right font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => {
              const p = byId.get(s.userId);
              return (
                <tr
                  key={s.userId}
                  className="border-t border-[color-mix(in_oklab,white_6%,transparent)] tabular-nums first:border-t-0 hover:bg-[color-mix(in_oklab,white_3%,transparent)]"
                >
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => onPickPerson(s.userId)}
                      title="See their daily log"
                      className="flex min-w-0 items-center gap-2 text-left hover:underline"
                    >
                      <Avatar avatarUrl={p?.avatarUrl} image={p?.image} name={p?.name} size={20} />
                      <span className="truncate">{p?.name ?? "Member"}</span>
                      {p?.left && <span className="text-[11px] text-faint">left</span>}
                    </button>
                  </td>
                  <Num value={s.completed} strong />
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {s.onTimeRate === null ? "–" : `${Math.round(s.onTimeRate * 100)}%`}
                  </td>
                  <Num value={s.started} />
                  <Num value={s.added} />
                  <Num value={s.comments} />
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {s.meetings === 0 ? (
                      "0"
                    ) : (
                      <>
                        {s.meetings}
                        <span className="text-faint"> · {formatMinutes(s.meetingMinutes)}</span>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {s.activeDays}
                    <span className="text-faint"> / {days.length}</span>
                  </td>
                  <Num value={s.openNow} />
                  <td
                    className="px-3 py-2 text-right"
                    style={{ color: s.overdueNow > 0 ? "var(--status-red)" : undefined }}
                  >
                    {s.overdueNow}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="panel p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-semibold">Which days</h3>
            <p className="text-[12px] text-faint">
              Lines in the daily log per person per day. Click a day to open it.
            </p>
          </div>
          {showGrid && (
            <div className="flex items-center gap-1.5 text-[11px] text-faint" aria-hidden>
              Fewer
              {LEGEND.map((n) => (
                <span
                  key={n}
                  className="h-3.5 w-3.5 rounded-[3px] border border-[color-mix(in_oklab,white_10%,transparent)]"
                  style={cellStyle(n)}
                />
              ))}
              More
            </div>
          )}
        </div>

        {showGrid ? (
          <div className="overflow-x-auto pb-1">
            <table className="border-separate border-spacing-[3px] text-[11px]">
              <thead>
                <tr>
                  <th />
                  {days.map((d) => {
                    const weekday = weekdayOf(d);
                    const weekend = weekday === 0 || weekday === 6;
                    return (
                      <th
                        key={d}
                        className="w-7 text-center font-normal tabular-nums leading-tight"
                        style={{ color: weekend ? "var(--text-faint)" : "var(--muted-foreground)" }}
                      >
                        <span className="block text-[9px] uppercase">{WEEKDAYS[weekday].slice(0, 2)}</span>
                        {d.slice(8, 10)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => {
                  const p = byId.get(s.userId);
                  return (
                    <tr key={s.userId}>
                      <th className="max-w-[10rem] truncate pr-3 text-left text-[12px] font-normal text-muted-foreground">
                        {p?.name ?? "Member"}
                      </th>
                      {days.map((d) => {
                        const n = s.perDay[d] ?? 0;
                        const done = s.completedPerDay[d] ?? 0;
                        const label = `${p?.name ?? "Member"} · ${dayHeading(d)} · ${
                          n === 0
                            ? "nothing logged"
                            : `${n} ${n === 1 ? "line" : "lines"}${done ? `, ${done} completed` : ""}`
                        }`;
                        return (
                          <td key={d} className="p-0">
                            <button
                              type="button"
                              title={label}
                              aria-label={label}
                              disabled={n === 0}
                              onClick={() => onPickDay(s.userId, d)}
                              className="flex h-7 w-7 items-center justify-center rounded-[5px] border border-[color-mix(in_oklab,white_7%,transparent)] tabular-nums transition-transform enabled:hover:scale-110 disabled:cursor-default"
                              style={cellStyle(n)}
                            >
                              {n > 0 ? n : ""}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[12px] text-faint">
            The grid shows up to two months at a time. Pick a shorter range to see it.
          </p>
        )}
      </section>
    </div>
  );
}

function Num({ value, strong }: { value: number; strong?: boolean }) {
  return (
    <td
      className="px-3 py-2 text-right"
      style={{
        color: value === 0 ? "var(--text-faint)" : strong ? "var(--foreground)" : "var(--muted-foreground)",
        fontWeight: strong && value > 0 ? 600 : undefined,
      }}
    >
      {value}
    </td>
  );
}
