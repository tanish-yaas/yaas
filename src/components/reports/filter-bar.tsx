"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/validators/task";
import {
  addDaysToKey,
  addMonthsToKey,
  daysBetweenKeys,
  istMonthStartKey,
  istWeekStartKey,
} from "@/lib/dates";
import {
  ACTIVITY_KINDS,
  PRIORITY_LABELS,
  RANGE_PRESETS,
  STATUS_LABELS,
  hasNarrowingFilters,
  periodLabel,
  type RangePreset,
  type ReportFilters,
  type ReportLabel,
  type ReportPerson,
  type ReportTeam,
} from "@/lib/reports";
import { PeoplePicker } from "./people-picker";

export type ReportAudienceView = {
  people: ReportPerson[];
  teams: ReportTeam[];
  labels: ReportLabel[];
  canSeeOthers: boolean;
};

function monthEnd(key: string) {
  return addDaysToKey(addMonthsToKey(key, 1), -1);
}

/**
 * The range one step earlier or later. A calendar month steps by a month and
 * a Monday-to-Sunday week by a week, including the ones still running: back
 * from "this week" on a Thursday is all of last week, not the four days
 * before Monday. Anything else steps by its own length.
 */
function shiftRange(from: string, to: string, direction: 1 | -1, todayKey: string) {
  const wholeWeek =
    from === istWeekStartKey(from) &&
    (to === addDaysToKey(from, 6) || (to === todayKey && daysBetweenKeys(from, to) < 7));

  if (wholeWeek) {
    const nextFrom = addDaysToKey(from, direction * 7);
    const end = addDaysToKey(nextFrom, 6);
    return { from: nextFrom, to: end > todayKey ? todayKey : end };
  }

  const wholeMonth =
    from === istMonthStartKey(from) &&
    (to === monthEnd(from) || (to === todayKey && to.slice(0, 7) === from.slice(0, 7)));

  if (wholeMonth) {
    const nextFrom = addMonthsToKey(from, direction);
    const end = monthEnd(nextFrom);
    return { from: nextFrom, to: end > todayKey ? todayKey : end };
  }

  const length = daysBetweenKeys(from, to) + 1;
  const nextFrom = addDaysToKey(from, direction * length);
  const nextTo = addDaysToKey(to, direction * length);
  return { from: nextFrom, to: nextTo > todayKey ? todayKey : nextTo };
}

export function FilterBar({
  filters,
  audience,
  selfId,
  todayKey,
  onChange,
}: {
  filters: ReportFilters;
  audience: ReportAudienceView;
  selfId: string;
  todayKey: string;
  onChange: (next: ReportFilters) => void;
}) {
  const extraCount =
    (filters.labelId ? 1 : 0) +
    filters.priorities.length +
    filters.statuses.length +
    (filters.q ? 1 : 0);

  const [open, setOpen] = useState(extraCount > 0);

  const set = (patch: Partial<ReportFilters>) => onChange({ ...filters, ...patch });

  const custom = filters.preset === null;
  const atToday = filters.to >= todayKey;

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => set({ preset: null, ...shiftRange(filters.from, filters.to, -1, todayKey) })}
            className="icon-btn h-7 w-7"
            title="Earlier"
            aria-label="Earlier period"
          >
            <ChevronLeft size={14} />
          </button>

          <label className="pill pill-sm cursor-pointer pr-2">
            <CalendarRange size={13} className="shrink-0" />
            <select
              aria-label="Period"
              value={filters.preset ?? "custom"}
              onChange={(e) => {
                const value = e.target.value;
                if (value === "custom") set({ preset: null });
                else set({ preset: value as RangePreset });
              }}
              className="cursor-pointer bg-transparent pr-1 text-[12px] outline-none"
            >
              {RANGE_PRESETS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
              <option value="custom">Custom range</option>
            </select>
          </label>

          <button
            type="button"
            disabled={atToday}
            onClick={() => set({ preset: null, ...shiftRange(filters.from, filters.to, 1, todayKey) })}
            className="icon-btn h-7 w-7 disabled:pointer-events-none disabled:opacity-35"
            title="Later"
            aria-label="Later period"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {custom ? (
          // Pills rather than .field: .field is unlayered CSS, so its padding
          // wins over any utility and the inputs stood taller than the bar.
          <div className="flex items-center gap-1.5 text-[12px] text-faint">
            <label className="pill pill-sm">
              <input
                type="date"
                aria-label="From"
                value={filters.from}
                max={todayKey}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) set({ preset: null, from: v, to: v > filters.to ? v : filters.to });
                }}
                className="bg-transparent text-[12px] tabular-nums text-foreground outline-none [color-scheme:dark]"
              />
            </label>
            to
            <label className="pill pill-sm">
              <input
                type="date"
                aria-label="To"
                value={filters.to}
                max={todayKey}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) set({ preset: null, to: v, from: v < filters.from ? v : filters.from });
                }}
                className="bg-transparent text-[12px] tabular-nums text-foreground outline-none [color-scheme:dark]"
              />
            </label>
          </div>
        ) : (
          <span className="text-[12px] tabular-nums text-faint">
            {periodLabel(filters.from, filters.to)}
          </span>
        )}

        <span className="mx-1 hidden h-4 w-px bg-border sm:block" />

        {audience.canSeeOthers && (
          <PeoplePicker
            people={audience.people}
            selected={filters.people}
            selfId={selfId}
            onChange={(people) => set({ people })}
          />
        )}

        {audience.canSeeOthers && audience.teams.length > 0 && (
          <label className="pill pill-sm cursor-pointer pr-2" data-on={!!filters.teamId}>
            <select
              aria-label="Team"
              value={filters.teamId ?? ""}
              onChange={(e) => set({ teamId: e.target.value || null })}
              className="cursor-pointer bg-transparent pr-1 text-[12px] outline-none"
            >
              <option value="">All teams</option>
              {audience.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          data-on={open || extraCount > 0}
          className="pill pill-sm"
          aria-expanded={open}
        >
          <SlidersHorizontal size={13} />
          Filters
          {extraCount > 0 && (
            <span className="rounded-full bg-[var(--primary)] px-1.5 text-[10px] font-medium tabular-nums text-white">
              {extraCount}
            </span>
          )}
        </button>

        {(hasNarrowingFilters(filters) || filters.preset !== "this-week") && (
          <button
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                preset: "this-week",
                people: [],
                teamId: null,
                labelId: null,
                priorities: [],
                statuses: [],
                q: "",
                kinds: [...ACTIVITY_KINDS],
              })
            }
            className="flex items-center gap-1 text-[12px] text-faint transition-colors hover:text-foreground"
          >
            <RotateCcw size={11} />
            Reset
          </button>
        )}
      </div>

      {open && (
        <div className="panel-ghost flex flex-wrap items-center gap-x-5 gap-y-2.5 rounded-xl px-3 py-2.5">
          <PillGroup
            label="Priority"
            options={TASK_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
            selected={filters.priorities}
            onChange={(priorities) => set({ priorities })}
          />
          <PillGroup
            label="Status now"
            options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            selected={filters.statuses}
            onChange={(statuses) => set({ statuses })}
          />

          {audience.labels.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.1em] text-faint">Label</span>
              <label className="pill pill-sm cursor-pointer pr-2" data-on={!!filters.labelId}>
                <select
                  aria-label="Label"
                  value={filters.labelId ?? ""}
                  onChange={(e) => set({ labelId: e.target.value || null })}
                  className="cursor-pointer bg-transparent pr-1 text-[12px] outline-none"
                >
                  <option value="">Any</option>
                  {audience.labels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <SearchBox value={filters.q} onCommit={(q) => set({ q })} />
        </div>
      )}
    </div>
  );
}

function PillGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-[11px] uppercase tracking-[0.1em] text-faint">{label}</span>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            data-on={on}
            aria-pressed={on}
            onClick={() =>
              onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])
            }
            className="pill pill-sm"
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Applies a moment after typing stops, so each keystroke is not a reload. */
function SearchBox({ value, onCommit }: { value: string; onCommit: (q: string) => void }) {
  const [text, setText] = useState(value);
  const timer = useRef<number | null>(null);

  // Reset clears the query from outside; the box follows.
  const [outside, setOutside] = useState(value);
  if (outside !== value) {
    setOutside(value);
    setText(value);
  }

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  return (
    <div className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-lg border border-[color-mix(in_oklab,white_10%,transparent)] bg-[color-mix(in_oklab,var(--card)_78%,transparent)] px-2.5 py-1">
      <Search size={12} className="shrink-0 text-faint" />
      <input
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => onCommit(next.trim()), 450);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (timer.current) window.clearTimeout(timer.current);
            onCommit(text.trim());
          }
        }}
        placeholder="Task or meeting title contains"
        aria-label="Search titles"
        className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-faint"
      />
    </div>
  );
}
