"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Ban, Check, Trash2, Circle, Pencil } from "lucide-react";
import { setTaskStatus, deleteTask, updateTask } from "@/server/actions/tasks";
import { useToast } from "@/components/ui/toast";
import { TaskDetailSheet } from "./task-detail-sheet";

const PRIORITY_STYLE: Record<string, string> = {
  URGENT: "bg-[#FF4D6D]/15 text-[#FF4D6D]",
  HIGH: "bg-[#F5B544]/15 text-[#F5B544]",
  MEDIUM: "bg-[#22D3EE]/15 text-[#22D3EE]",
  LOW: "bg-secondary text-muted-foreground",
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
  /** Subtask progress, when the task has any. */
  subtasks?: { done: number; total: number };
  labels?: { id: string; name: string; color: string }[];
  /** How many incomplete tasks are holding this one up. */
  blockedBy?: number;
  /** Had blockers, all of them are finished. */
  readyToStart?: boolean;
};

const field =
  "w-full rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-brand-violet";

export function TaskRow({ task }: { task: TaskRowData }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      push("Task deleted");
    });
  }

  function save() {
    setError(null);
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
        setError(result.error);
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
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-lg border border-brand-violet/30 bg-brand-violet/5 px-3 py-3"
      >
        <div className="flex flex-col gap-2.5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className={`${field} text-sm`}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Notes…"
            className={field}
          />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={field}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>

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

            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={field}
            />

            <input
              type="number"
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              placeholder="mins"
              className={field}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/40 ${
        pending ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all active:scale-90 ${
          done
            ? "border-brand-violet bg-brand-violet text-white"
            : "border-border text-transparent hover:border-brand-violet hover:bg-brand-violet/10"
        }`}
      >
        {done ? <Check size={12} /> : <Circle size={6} />}
      </button>

      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        className="min-w-0 flex-1 text-left"
      >
        <p
          className={`truncate text-sm transition-colors ${
            done ? "text-muted-foreground line-through" : ""
          }`}
        >
          {task.title}
        </p>
        <span className="flex items-center gap-2">
          {task.assignees.length > 0 && (
            <span className="truncate text-[11px] text-muted-foreground/70">
              {task.assignees.join(", ")}
            </span>
          )}
          {task.subtasks && task.subtasks.total > 0 && (
            <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {task.subtasks.done}/{task.subtasks.total}
            </span>
          )}
        </span>
      </button>

      {!done && task.blockedBy !== undefined && task.blockedBy > 0 && (
        <span
          title={`Waiting on ${task.blockedBy} unfinished ${
            task.blockedBy === 1 ? "task" : "tasks"
          }`}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FF4D6D]/12 px-2 py-0.5 text-[10px] text-[#FF4D6D]"
        >
          <Ban size={10} />
          Blocked
        </span>
      )}

      {!done && task.readyToStart && (
        <span
          title="Every blocker is done"
          className="hidden shrink-0 items-center gap-1 rounded-full bg-[#4ADE80]/12 px-2 py-0.5 text-[10px] text-[#4ADE80] sm:inline-flex"
        >
          Ready
        </span>
      )}

      {task.labels && task.labels.length > 0 && (
        <span className="hidden shrink-0 items-center gap-1 sm:flex">
          {task.labels.slice(0, 3).map((label) => (
            <span
              key={label.id}
              className="rounded-full px-1.5 py-0.5 text-[10px]"
              style={{
                color: label.color,
                backgroundColor: `color-mix(in oklab, ${label.color} 18%, transparent)`,
              }}
            >
              {label.name}
            </span>
          ))}
        </span>
      )}

      <TaskDetailSheet
        taskId={detailOpen ? task.id : null}
        onClose={() => setDetailOpen(false)}
      />

      {task.dueAtLabel && (
        <span
          className={`shrink-0 text-[11px] tabular-nums ${
            task.overdue && !done ? "text-[#FF4D6D]" : "text-muted-foreground"
          }`}
        >
          {task.dueAtLabel}
        </span>
      )}

      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
          PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.LOW
        }`}
      >
        {task.priority}
      </span>

      <button
        type="button"
        onClick={() => setEditing(true)}
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-all hover:text-foreground group-hover:opacity-100"
      >
        <Pencil size={13} />
      </button>

      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className={`shrink-0 rounded px-1.5 py-1 text-[10px] transition-all ${
          confirming
            ? "bg-destructive/15 text-destructive opacity-100"
            : "text-muted-foreground opacity-0 group-hover:opacity-100"
        }`}
      >
        {confirming ? "Sure?" : <Trash2 size={14} />}
      </button>
    </motion.div>
  );
}