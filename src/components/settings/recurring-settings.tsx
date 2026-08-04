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

const field =
  "w-full rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand-violet";

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
    <div className={`glass rounded-xl px-5 py-5 ${pending ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm">
            <Repeat size={14} className="text-brand-violet" />
            Recurring tasks
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Nova creates each run on schedule and assigns it for you.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus size={13} />
            New
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-4 rounded-lg border border-brand-violet/30 bg-brand-violet/5 px-3 py-3">
          <div className="flex items-center gap-2">
            <input
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className={`${field} text-sm`}
            />
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
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
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
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

          <div className="mt-3 rounded-lg border border-border/60 px-2.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Repeat</span>
              <select
                value={freq}
                onChange={(e) =>
                  setFreq(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY")
                }
                className={`${field} w-auto`}
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
              <span className="text-xs text-muted-foreground">every</span>
              <input
                type="number"
                min={1}
                max={52}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value) || 1)}
                className={`${field} w-16`}
              />
              <span className="text-xs text-muted-foreground">
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
                      onClick={() =>
                        setByWeekday((prev) =>
                          on
                            ? prev.filter((x) => x !== d.value)
                            : [...prev, d.value]
                        )
                      }
                      className={`rounded-lg px-2.5 py-1 text-[11px] transition-colors ${
                        on
                          ? "bg-brand-violet/15 text-brand-violet"
                          : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            )}

            {freq === "MONTHLY" && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">On day</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={byMonthDay}
                  onChange={(e) => setByMonthDay(Number(e.target.value) || 1)}
                  className={`${field} w-20`}
                />
                <span className="text-[10px] text-muted-foreground/70">
                  Months without that day are skipped.
                </span>
              </div>
            )}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Assign to
            </span>
            <div className="mt-1 flex max-h-24 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-secondary/30 px-2 py-2">
              {members.map((m) => (
                <label
                  key={m.userId}
                  className="flex cursor-pointer items-center gap-2 text-xs"
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
                    className="h-3.5 w-3.5 accent-[#7C5CFF]"
                  />
                  <span className="truncate">{m.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
            className="mt-3 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Create it
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-1">
        {rows.length === 0 && !adding && (
          <p className="py-4 text-xs text-muted-foreground/70">
            Nothing recurring yet.
          </p>
        )}

        {rows.map((row) => (
          <div
            key={row.id}
            className={`group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/40 ${
              row.isActive ? "" : "opacity-60"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs">{row.title}</p>
              <p className="truncate text-[10px] text-muted-foreground">
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
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {row.isActive ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(row.id)}
                  className={`shrink-0 rounded px-1.5 py-1 text-[10px] transition-all ${
                    confirmingId === row.id
                      ? "bg-destructive/15 text-destructive opacity-100"
                      : "text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                  }`}
                >
                  {confirmingId === row.id ? "Sure?" : <Trash2 size={13} />}
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
