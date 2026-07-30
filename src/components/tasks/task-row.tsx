"use client";

import { useState, useTransition } from "react";
import { Check, Trash2, Circle } from "lucide-react";
import { setTaskStatus, deleteTask } from "@/server/actions/tasks";

const PRIORITY_STYLE: Record<string, string> = {
  URGENT: "bg-[#FF4D6D]/15 text-[#FF4D6D]",
  HIGH: "bg-[#F5B544]/15 text-[#F5B544]",
  MEDIUM: "bg-[#22D3EE]/15 text-[#22D3EE]",
  LOW: "bg-secondary text-muted-foreground",
};

export type TaskRowData = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueAt: string | null;
  assignees: string[];
  overdue: boolean;
};

export function TaskRow({ task }: { task: TaskRowData }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const done = task.status === "DONE";

  function toggle() {
    startTransition(async () => {
      await setTaskStatus(task.id, done ? "TODO" : "DONE");
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
    });
  }

  return (
    <div
      className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/40 ${
        pending ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          done
            ? "border-brand-violet bg-brand-violet text-white"
            : "border-border text-transparent hover:border-brand-violet"
        }`}
      >
        {done ? <Check size={12} /> : <Circle size={6} />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm ${
            done ? "text-muted-foreground line-through" : ""
          }`}
        >
          {task.title}
        </p>
        {task.assignees.length > 0 && (
          <p className="truncate text-[11px] text-muted-foreground/70">
            {task.assignees.join(", ")}
          </p>
        )}
      </div>

      {task.dueAt && (
        <span
          className={`shrink-0 text-[11px] ${
            task.overdue && !done ? "text-[#FF4D6D]" : "text-muted-foreground"
          }`}
        >
          {task.dueAt}
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
    </div>
  );
}