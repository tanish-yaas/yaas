"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { FileSpreadsheet, FileText, Loader2, TriangleAlert } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  formatMinutes,
  presetRange,
  reportSearch,
  type ReportFilters,
  type ReportGroup,
  type ReportTab,
  type WorkReport,
} from "@/lib/reports";
import { FilterBar, type ReportAudienceView } from "./filter-bar";
import { DailyLog } from "./daily-log";
import { PeopleView } from "./people-view";
import { TasksView } from "./tasks-view";

// Deferred like everywhere else: the sheet is the largest component in the
// app and most visits to a report never open a task.
const TaskDetailSheet = dynamic(
  () => import("@/components/tasks/task-detail-sheet").then((m) => m.TaskDetailSheet),
  { ssr: false }
);

const TABS: { key: ReportTab; label: string }[] = [
  { key: "log", label: "Daily log" },
  { key: "people", label: "People" },
  { key: "tasks", label: "Tasks" },
];

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat" title={hint}>
      <p className="truncate text-[10px] uppercase tracking-[0.12em] text-faint">{label}</p>
      <p className="mt-1.5 text-[20px] font-semibold leading-none tabular-nums">{value}</p>
    </div>
  );
}

/**
 * The Reports tab. Filters live in the URL, so a view is a link and the
 * download is that same link with a format on the end. Tab and grouping are
 * only how the same data is laid out, so they change the URL without a trip
 * to the server.
 */
export function ReportScreen({
  report,
  hiddenLines,
  audience,
  todayKey,
  selfId,
}: {
  report: WorkReport;
  /** Older log lines left off the screen for size. The downloads have them. */
  hiddenLines: number;
  audience: ReportAudienceView;
  todayKey: string;
  selfId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();

  // Optimistic: the controls show what was picked while the server catches
  // up, instead of snapping back until the new report lands.
  const [filters, setFilters] = useState(report.filters);
  const { tab, group } = filters;
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pdf" | "xlsx" | null>(null);

  // Follow the server once a navigation lands: adjusted during render, the
  // way React suggests, rather than in an effect that renders twice.
  const [landed, setLanded] = useState(report.filters);
  if (landed !== report.filters) {
    setLanded(report.filters);
    setFilters(report.filters);
  }

  const href = (f: ReportFilters) => {
    const q = reportSearch(f);
    return q ? `${pathname}?${q}` : pathname;
  };

  function navigate(next: ReportFilters) {
    const full = next.preset ? { ...next, ...presetRange(next.preset, todayKey) } : next;
    setFilters(full);
    startTransition(() => router.replace(href(full), { scroll: false }));
  }

  function setView(nextTab: ReportTab, nextGroup: ReportGroup) {
    const next = { ...filters, tab: nextTab, group: nextGroup };
    setFilters(next);
    window.history.replaceState(null, "", href(next));
  }

  async function download(format: "pdf" | "xlsx") {
    if (busy) return;
    setBusy(format);
    try {
      const q = reportSearch(filters);
      const res = await fetch(`${pathname}/export?${q ? `${q}&` : ""}format=${format}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        push((await res.text()) || "Couldn't make that file. Try again.", "error");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `nova-work-report.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      push("Couldn't reach Nova to make that file.", "error");
    } finally {
      setBusy(null);
    }
  }

  const { totals } = report;
  const solo = report.people.length === 1;
  const soloSummary = solo ? report.summaries[0] : undefined;

  return (
    <div className="w-full">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-faint">
            Who did what, and on which day. Built from the tasks, comments and meetings already
            in Nova, so there is no daily sheet to keep.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-[11px] text-faint sm:inline">Download</span>
          {(
            [
              ["pdf", "PDF", FileText],
              ["xlsx", "Excel", FileSpreadsheet],
            ] as const
          ).map(([format, label, Icon]) => (
            <button
              key={format}
              type="button"
              onClick={() => download(format)}
              disabled={!!busy}
              className="pill pill-sm disabled:opacity-60"
              title={
                format === "pdf"
                  ? "A printable report: summary, daily log and tasks"
                  : "Every field, on sheets you can sort and filter"
              }
            >
              {busy === format ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Icon size={13} />
              )}
              {busy === format ? "Preparing" : label}
            </button>
          ))}
        </div>
      </header>

      <FilterBar
        filters={filters}
        audience={audience}
        selfId={selfId}
        todayKey={todayKey}
        onChange={navigate}
      />

      <div
        className="transition-opacity duration-150"
        style={{ opacity: pending ? 0.55 : 1 }}
        aria-busy={pending}
      >
        {report.truncated && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-[color-mix(in_oklab,var(--status-amber)_40%,transparent)] bg-[color-mix(in_oklab,var(--status-amber)_10%,transparent)] px-3 py-2 text-[12px]">
            <TriangleAlert size={13} className="shrink-0 text-[var(--status-amber)]" />
            This range is too large to read in full, so some rows are missing. Pick a shorter
            range for the complete picture.
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Tile label="Completed" value={String(totals.completed)} hint="Tasks marked done in the period" />
          <Tile label="Started" value={String(totals.started)} hint="Tasks moved into In progress" />
          <Tile label="Comments" value={String(totals.comments)} />
          <Tile
            label="In meetings"
            value={formatMinutes(totals.meetingMinutes)}
            hint="Time in timed calendar events, added up across people"
          />
          {soloSummary ? (
            <Tile
              label="Active days"
              value={`${soloSummary.activeDays} of ${report.days.length}`}
              hint="Days with anything done, not counting ongoing work"
            />
          ) : (
            <Tile
              label="Active people"
              value={`${totals.activePeople} of ${report.people.length}`}
              hint="People with anything done in the period"
            />
          )}
          <Tile label="Overdue now" value={String(totals.overdueNow)} hint="Open and past due, as of now" />
        </div>

        <div className="mb-3 flex items-center gap-1" role="tablist">
          {TABS.map((t) => {
            const count =
              t.key === "log"
                ? report.entries.length + hiddenLines
                : t.key === "people"
                  ? report.people.length
                  : report.tasks.length;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                data-on={tab === t.key}
                onClick={() => setView(t.key, group)}
                className="pill pill-sm"
              >
                {t.label}
                <span className="tabular-nums opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {tab === "log" && (
          <DailyLog
            entries={report.entries}
            people={report.people}
            from={report.filters.from}
            to={report.filters.to}
            hiddenLines={hiddenLines}
            group={group}
            kinds={filters.kinds}
            onKinds={(kinds) => navigate({ ...filters, kinds })}
            onGroup={(g) => setView(tab, g)}
            onOpenTask={setOpenTask}
          />
        )}

        {tab === "people" && (
          <PeopleView
            people={report.people}
            summaries={report.summaries}
            days={report.days}
            onPickPerson={(userId) =>
              navigate({ ...filters, people: [userId], teamId: null, tab: "log" })
            }
            onPickDay={(userId, dayKey) =>
              navigate({
                ...filters,
                preset: null,
                from: dayKey,
                to: dayKey,
                people: [userId],
                teamId: null,
                tab: "log",
              })
            }
          />
        )}

        {tab === "tasks" && <TasksView tasks={report.tasks} onOpenTask={setOpenTask} />}
      </div>

      {openTask && (
        <TaskDetailSheet
          taskId={openTask}
          onClose={() => {
            setOpenTask(null);
            // Edits in the sheet revalidate the task pages, not this one.
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
