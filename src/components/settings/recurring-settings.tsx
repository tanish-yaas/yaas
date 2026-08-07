"use client";

import { useState, useTransition } from "react";
import { Pause, Play, Plus, Repeat, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { toLocalInput } from "@/lib/dates";
import {
  createRecurringTask,
  deleteRecurringTask,
  setRecurringActive,
} from "@/server/actions/recurring";
import { LabelPicker, type LabelOption } from "@/components/tasks/label-picker";
import { SettingsPanel } from "./settings-panel";

export type RecurringRow = {
  id: string;
  title: string;
  summary: string;
  nextRunAt: string | null;
  runCount: number;
  isActive: boolean;
  canManage: boolean;
};

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const field = "field";

const sectionLabel = "text-[11px] uppercase tracking-[0.12em] text-faint";

export function RecurringSettings({
  rows,
  members,
  labels,
  currentUserId,
}: {
  rows: RecurringRow[];
  members: { userId: string; name: string }[];
  labels: LabelOption[];
  currentUserId: string;
}) {
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [estimate, setEstimate] = useState("");
  const [startsAt, setStartsAt] = useState(() => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    return toLocalInput(tomorrow).slice(0, 11) + "09:00";
  });
  const [endsAt, setEndsAt] = useState("");
  const [freq, setFreq] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("WEEKLY");
  const [interval, setInterval] = useState(1);
  const [byWeekday, setByWeekday] = useState<number[]>([1]);
  const [byMonthDay, setByMonthDay] = useState(1);
  const [assignees, setAssignees] = useState<string[]>([currentUserId]);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [labelOptions, setLabelOptions] = useState<LabelOption[]>(labels);

  function reset() {
    setTitle("");
    setDescription("");
    setEstimate("");
    setLabelIds([]);
    setAdding(false);
  }

  function create() {
    startTransition(async () => {
      const recurrence =
        freq === "DAILY"
          ? { freq: "DAILY" as const, interval }
          : freq === "WEEKLY"
            ? { freq: "WEEKLY" as const, interval, byWeekday }
            : { freq: "MONTHLY" as const, interval, byMonthDay };

      const result = await createRecurringTask({
        title,
        description,
        priority,
        estimatedMinutes: estimate,
        startsAt,
        endsAt,
        assigneeIds: assignees,
        labelIds,
        recurrence,
      });

      if (!result.ok) {
        push(result.error, "error");
        return;
      }

      reset();
      push("Repeating task created");
    });
  }

  function toggle(row: RecurringRow) {
    startTransition(async () => {
      const result = await setRecurringActive(row.id, !row.isActive);
      if (!result.ok) {
        push(result.error, "error");
        return;
      }
      push(row.isActive ? "Paused" : "Resumed");
    });
  }

  function remove(id: string) {
    if (confirmingId !== id) {
      setConfirmingId(id);
      window.setTimeout(
        () => setConfirmingId((current) => (current === id ? null : current)),
        3000
      );
      return;
    }

    startTransition(async () => {
      const result = await deleteRecurringTask(id);
      setConfirmingId(null);
      if (!result.ok) {
        push(result.error, "error");
        return;
      }
      push("Repeating task deleted");
    });
  }

  return (
    <SettingsPanel
      title="Recurring tasks"
      icon={<Repeat size={12} style={{ color: "var(--primary)" }} />}
      dimmed={pending}
      description="Nova creates each run on schedule and assigns it for you."
      action={
        !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="pill pill-sm shrink-0"
          >
            <Plus size={12} />
            New
          </button>
        )
      }
    >
      {adding && (
        <div className="rounded-xl border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-[color-mix(in_oklab,var(--primary)_6%,transparent)] px-3 py-3">
          <div className="flex items-center gap-2">
            <input
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className={field}
            />
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="shrink-0 rounded p-1 text-faint transition-colors hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Notes carried onto every run…"
            className={`${field} mt-2`}
          />

          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className={sectionLabel}>
                Priority
              </span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={field}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className={sectionLabel}>
                Estimate (min)
              </span>
              <input
                type="number"
                min={0}
                value={estimate}
                onChange={(e) => setEstimate(e.target.value)}
                placeholder="60"
                className={field}
              />
            </label>
          </div>

          <div className="mt-3 rounded-xl border border-[color-mix(in_oklab,white_9%,transparent)] px-2.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-faint">Repeat</span>
              <select
                value={freq}
                onChange={(e) =>
                  setFreq(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY")
                }
                className={`${field} field-auto`}
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
              <span className="text-[12px] text-faint">every</span>
              <input
                type="number"
                min={1}
                max={52}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value) || 1)}
                className={`${field} field-auto`}
                style={{ width: "4rem" }}
              />
              <span className="text-[12px] text-faint">
                {freq === "DAILY"
                  ? "day(s)"
                  : freq === "WEEKLY"
                    ? "week(s)"
                    : "month(s)"}
              </span>
            </div>

            {freq === "WEEKLY" && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {DAYS.map((d) => {
                  const on = byWeekday.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      data-on={on}
                      onClick={() =>
                        setByWeekday((prev) =>
                          on
                            ? prev.filter((x) => x !== d.value)
                            : [...prev, d.value]
                        )
                      }
                      className="pill pill-sm"
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            )}

            {freq === "MONTHLY" && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[12px] text-faint">On day</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={byMonthDay}
                  onChange={(e) => setByMonthDay(Number(e.target.value) || 1)}
                  className={`${field} field-auto`}
                  style={{ width: "5rem" }}
                />
                <span className="text-[11px] text-faint">
                  Months without that day are skipped.
                </span>
              </div>
            )}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className={sectionLabel}>
                Starts
              </span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className={field}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className={sectionLabel}>
                Ends (optional)
              </span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={field}
              />
            </label>
          </div>

          <div className="mt-2">
            <span className={sectionLabel}>
              Assign to
            </span>
            <div className="mt-1 flex max-h-24 flex-col gap-1 overflow-y-auto rounded-xl border border-[color-mix(in_oklab,white_9%,transparent)] px-2 py-2">
              {members.map((m) => (
                <label
                  key={m.userId}
                  className="flex cursor-pointer items-center gap-2 text-[12px]"
                >
                  <input
                    type="checkbox"
                    checked={assignees.includes(m.userId)}
                    onChange={(e) =>
                      setAssignees((prev) =>
                        e.target.checked
                          ? [...prev, m.userId]
                          : prev.filter((id) => id !== m.userId)
                      )
                    }
                    className="h-3.5 w-3.5 accent-[var(--primary)]"
                  />
                  <span className="truncate">{m.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-2">
            <span className={sectionLabel}>
              Labels
            </span>
            <div className="mt-1">
              <LabelPicker
                value={labelIds}
                options={labelOptions}
                onChange={setLabelIds}
                onCreated={(label) =>
                  setLabelOptions((prev) => [...prev, label])
                }
              />
            </div>
          </div>

          <button
            type="button"
            onClick={create}
            disabled={pending || !title.trim()}
            className="mt-3 inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Create it
          </button>
        </div>
      )}

      <div className={`flex flex-col gap-1 ${adding ? "mt-4" : ""}`}>
        {rows.length === 0 && !adding && (
          <div className="py-6 text-center">
            <p className="text-[13px] text-muted-foreground">
              Nothing recurring yet
            </p>
            <p className="mt-1 text-[12px] text-faint">
              Set one up and Nova files each run for you.
            </p>
          </div>
        )}

        {rows.map((row) => (
          <div
            key={row.id}
            className={`group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[color-mix(in_oklab,white_4%,transparent)] ${
              row.isActive ? "" : "opacity-60"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px]">{row.title}</p>
              <p className="truncate text-[11px] text-faint">
                {row.summary}
                {row.nextRunAt && row.isActive && ` · next ${row.nextRunAt}`}
                {!row.isActive && " · paused"}
                {row.runCount > 0 && ` · ${row.runCount} created`}
              </p>
            </div>

            {row.canManage && (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggle(row)}
                  title={row.isActive ? "Pause" : "Resume"}
                  className="shrink-0 rounded p-1 text-faint transition-colors hover:text-foreground"
                >
                  {row.isActive ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(row.id)}
                  className={`shrink-0 rounded px-1.5 py-1 text-[10px] ${
                    confirmingId === row.id
                      ? "text-[var(--status-red)]"
                      : "hover-action hover-action--danger"
                  }`}
                >
                  {confirmingId === row.id ? "Sure?" : <Trash2 size={13} />}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </SettingsPanel>
  );
}
