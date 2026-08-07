"use client";

import { useState, useTransition } from "react";
import { Check, Trash2, Pencil } from "lucide-react";
import { setTaskStatus, deleteTask, updateTask } from "@/server/actions/tasks";
import { useToast } from "@/components/ui/toast";

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "var(--status-red)",
  HIGH: "var(--status-amber)",
  MEDIUM: "var(--status-blue)",
  LOW: "var(--text-faint)",
};

const STATUSES = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "DONE",
];

export type TaskRowData = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueAtInput: string;
  dueAtLabel: string | null;
  estimatedMinutes: string;
  assignees: string[];
  overdue: boolean;
};

export function TaskRow({ task }: { task: TaskRowData }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const { push } = useToast();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState(task.status);
  const [dueAt, setDueAt] = useState(task.dueAtInput);
  const [estimate, setEstimate] = useState(task.estimatedMinutes);

  const done = task.status === "DONE";

  function toggle() {
    startTransition(async () => {
      await setTaskStatus(task.id, done ? "TODO" : "DONE");
      push(done ? "Reopened" : "Done");
    });
  }

  function remove() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    startTransition(async () => {
      await deleteTask(task.id);
      push("Deleted");
    });
  }

  function save() {
    startTransition(async () => {
      const result = await updateTask(task.id, {
        title,
        description,
        priority,
        status,
        dueAt,
        estimatedMinutes: estimate,
      });
      if (!result.ok) {
        push(result.error, "error");
        return;
      }
      setEditing(false);
      push("Saved");
    });
  }

  function cancel() {
    setTitle(task.title);
    setDescription(task.description);
    setPriority(task.priority);
    setStatus(task.status);
    setDueAt(task.dueAtInput);
    setEstimate(task.estimatedMinutes);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="border-b border-border px-2 py-3 last:border-0">
        <div className="flex flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="field"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Add a description…"
            className="field resize-none"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="field text-[12px]"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="field text-[12px]"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="field text-[12px]"
            />
            <input
              type="number"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              placeholder="mins"
              className="field text-[12px]"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded bg-primary px-2.5 py-1 text-[12px] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="text-[12px] text-faint transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group flex min-h-8 items-center gap-2.5 border-b border-border px-2 transition-colors last:border-0 hover:bg-[var(--bg-subtle)] ${
        pending ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
          done
            ? "border-primary bg-primary text-white"
            : "border-[var(--border-strong)] hover:border-primary"
        }`}
      >
        {done && <Check size={9} strokeWidth={3} />}
      </button>

      <button
        type="button"
        onClick={() => setEditing(true)}
        className="min-w-0 flex-1 py-1.5 text-left"
      >
        <span
          className={`block truncate text-[13px] ${
            done ? "text-faint line-through" : ""
          }`}
        >
          {task.title}
        </span>
        {task.assignees.length > 0 && (
          <span className="block truncate text-[11px] text-faint">
            {task.assignees.join(", ")}
          </span>
        )}
      </button>

      {task.dueAtLabel && (
        <span
          className="shrink-0 text-[11px] tabular-nums"
          style={{
            color:
              task.overdue && !done
                ? "var(--status-red)"
                : "var(--text-faint)",
          }}
        >
          {task.dueAtLabel}
        </span>
      )}

      <span
        className="shrink-0 text-[11px]"
        style={{ color: PRIORITY_COLOR[task.priority] }}
        title={task.priority}
      >
        {task.priority.charAt(0)}
      </span>

      <button
        type="button"
        onClick={() => setEditing(true)}
        className="hover-action shrink-0 rounded p-1"
      >
        <Pencil size={12} />
      </button>

      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className={`shrink-0 rounded px-1 py-1 text-[11px] transition-all ${
          confirming
            ? "text-[var(--status-red)] opacity-100"
            : "hover-action"
        }`}
      >
        {confirming ? "Sure?" : <Trash2 size={12} />}
      </button>
    </div>
  );
}