"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Check, ChevronRight, Trash2, Pencil } from "lucide-react";
import { setTaskStatus, deleteTask } from "@/server/actions/tasks";
import { setSubtaskDone } from "@/server/actions/task-detail";
import { useToast } from "@/components/ui/toast";
import type { LabelOption } from "./label-picker";

// Deferred for the same reason the board defers it: the sheet is the largest
// component in the app, and a list of rows should not pull it in until one of
// them is actually opened.
const TaskDetailSheet = dynamic(
  () =>
    import("@/components/tasks/task-detail-sheet").then(
      (m) => m.TaskDetailSheet
    ),
  { ssr: false }
);

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "var(--status-red)",
  HIGH: "var(--status-amber)",
  MEDIUM: "var(--status-blue)",
  LOW: "var(--text-faint)",
};

export type SubtaskRowData = {
  id: string;
  title: string;
  done: boolean;
};

export type TaskRowData = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueAtInput: string;
  dueAtLabel: string | null;
  /** Shown in place of the due date once the task is done. */
  doneAtLabel?: string | null;
  estimatedMinutes: string;
  assignees: string[];
  overdue: boolean;
  labels: LabelOption[];
  /** Children of this task, folded under it rather than listed as tasks of
      their own. Omitted by callers that don't group, i.e. the calendar. */
  subtasks?: SubtaskRowData[];
};

/**
 * One task in a list. Editing happens in the detail sheet rather than in the
 * row: an inline form could only reach the handful of fields it had space for,
 * and the same task opened from the board got the full set — so a task edited
 * from here could not be given an assignee, a team, a subtask or a comment.
 * One editor, reachable from every page.
 */
export function TaskRow({ task }: { task: TaskRowData }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { push } = useToast();

  const done = task.status === "DONE";
  const subtasks = task.subtasks ?? [];
  const doneSubtasks = subtasks.filter((s) => s.done).length;

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

  function toggleSubtask(id: string, next: boolean) {
    startTransition(async () => {
      const result = await setSubtaskDone(id, next);
      if (!result.ok) push(result.error, "error");
    });
  }

  return (
    <>
      <div className="border-b border-border last:border-0">
        <div
          className={`group flex min-h-8 items-center gap-2.5 px-2 transition-colors hover:bg-[var(--bg-subtle)] ${
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
            onClick={() => setOpen(true)}
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

          {subtasks.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              title={expanded ? "Hide subtasks" : "Show subtasks"}
              className="flex shrink-0 items-center gap-0.5 rounded px-1 text-[11px] tabular-nums text-faint transition-colors hover:text-foreground"
            >
              <ChevronRight
                size={11}
                className={`transition-transform ${
                  expanded ? "rotate-90" : ""
                }`}
              />
              {doneSubtasks}/{subtasks.length}
            </button>
          )}

          {task.labels.length > 0 && (
            <span className="hidden shrink-0 items-center gap-1 sm:flex">
              {task.labels.slice(0, 3).map((label) => (
                <span
                  key={label.id}
                  className="label-chip"
                  style={{ "--chip-color": label.color } as React.CSSProperties}
                >
                  {label.name}
                </span>
              ))}
            </span>
          )}

          {/* A finished task has no deadline left to meet, so the due date gives
              way to the day it was actually completed. */}
          {done
            ? task.doneAtLabel && (
                <span className="shrink-0 text-[11px] tabular-nums text-faint">
                  {task.doneAtLabel}
                </span>
              )
            : task.dueAtLabel && (
                <span
                  className="shrink-0 text-[11px] tabular-nums"
                  style={{
                    color: task.overdue
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
            onClick={() => setOpen(true)}
            title="Edit task"
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

        {expanded && subtasks.length > 0 && (
          <ul className="mb-1.5 ml-[26px] flex flex-col gap-1 border-l border-border pl-3">
            {subtasks.map((sub) => (
              <li key={sub.id} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggleSubtask(sub.id, !sub.done)}
                  className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                    sub.done
                      ? "border-primary bg-primary text-white"
                      : "border-[var(--border-strong)] hover:border-primary"
                  }`}
                >
                  {sub.done && <Check size={8} strokeWidth={3} />}
                </button>
                <span
                  className={`min-w-0 flex-1 truncate text-[12px] ${
                    sub.done ? "text-faint line-through" : "text-faint"
                  }`}
                >
                  {sub.title}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* The same sheet the board opens, so every entry point edits the whole
          task. Kept out of the tree until first open. */}
      {open && (
        <TaskDetailSheet taskId={task.id} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
