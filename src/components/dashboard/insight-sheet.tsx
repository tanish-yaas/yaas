"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Loader2, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  getInsightTasks,
  type InsightTask,
} from "@/server/actions/insights";
import type { InsightFilter } from "@/server/services/insights";
import { accentForSuggestion, iconForSuggestion } from "./suggestion-style";

const TaskDetailSheet = dynamic(
  () =>
    import("@/components/tasks/task-detail-sheet").then(
      (m) => m.TaskDetailSheet
    ),
  { ssr: false }
);

const STATUS_LABEL: Record<string, string> = {
  BACKLOG: "Backlog",
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  IN_REVIEW: "In review",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "var(--status-red)",
  HIGH: "var(--status-amber)",
  MEDIUM: "var(--status-blue)",
  LOW: "var(--text-faint)",
};

/**
 * The tasks behind an insight.
 *
 * An insight is a count, so unlike a suggestion there is nothing to accept —
 * this sheet exists to answer "which ones?", and every row opens the real task.
 */
export function InsightSheet({
  filter,
  reason,
  type,
  onClose,
}: {
  /** Null closes the sheet; the all-clear insight has no filter and never opens. */
  filter: NonNullable<InsightFilter> | null;
  reason: string;
  type: string;
  onClose: () => void;
}) {
  const { push } = useToast();
  const [mounted, setMounted] = useState(false);
  const [tasks, setTasks] = useState<InsightTask[] | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    if (!filter) return;
    setLoading(true);
    const result = await getInsightTasks(filter);
    setLoading(false);

    if (!result.ok) {
      push(result.error, "error");
      onClose();
      return;
    }
    setTitle(result.title);
    setTasks(result.tasks);
  }, [filter, onClose, push]);

  useEffect(() => {
    if (!filter) {
      setTasks(null);
      return;
    }
    void load();
  }, [filter, load]);

  useEffect(() => {
    if (!filter) return;
    const onKey = (e: KeyboardEvent) => {
      // The task sheet stacks on top and owns Escape while it is open.
      if (e.key === "Escape" && !openTaskId) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filter, onClose, openTaskId]);

  if (!mounted) return null;

  const accent = accentForSuggestion(type);

  const sheet = (
    <AnimatePresence>
      {filter && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[88] bg-black/50"
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-label={title || "Insight"}
            className="fixed inset-y-0 right-0 z-[89] flex w-full flex-col border-l border-border bg-card sm:w-[28rem]"
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0" style={{ color: accent }}>
                  {iconForSuggestion(type, 14)}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-faint">
                    Insight
                  </p>
                  <p className="mt-0.5 truncate text-[13px]">
                    {title || "Loading…"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded p-1 text-faint transition-colors hover:text-foreground"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {reason}
              </p>

              {loading && !tasks && (
                <div className="flex items-center gap-2 py-10 text-[12px] text-faint">
                  <Loader2 size={14} className="animate-spin" />
                  Loading tasks…
                </div>
              )}

              {tasks && tasks.length === 0 && (
                <p className="mt-6 text-[12px] text-faint">
                  Nothing here you can see. These may belong to people outside
                  your access.
                </p>
              )}

              {tasks && tasks.length > 0 && (
                <div className="mt-4 flex flex-col gap-1.5">
                  {tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setOpenTaskId(task.id)}
                      className="group w-full rounded-lg border border-[color-mix(in_oklab,white_9%,transparent)] bg-[color-mix(in_oklab,white_2%,transparent)] px-3 py-2.5 text-left transition-colors hover:border-[color-mix(in_oklab,white_18%,transparent)]"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              PRIORITY_COLOR[task.priority] ??
                              PRIORITY_COLOR.LOW,
                          }}
                        />
                        <p className="min-w-0 flex-1 text-[13px] leading-snug">
                          {task.title}
                        </p>
                        <ArrowUpRight
                          size={13}
                          className="mt-0.5 shrink-0 text-faint transition-colors group-hover:text-foreground"
                        />
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-4">
                        <span className="chip border-[color-mix(in_oklab,white_10%,transparent)] bg-[color-mix(in_oklab,white_5%,transparent)] text-faint">
                          {STATUS_LABEL[task.status] ?? task.status}
                        </span>

                        {task.dueLabel && (
                          <span
                            className={`chip ${
                              task.overdue
                                ? "border-[color-mix(in_oklab,var(--status-red)_45%,transparent)] bg-[color-mix(in_oklab,var(--status-red)_18%,transparent)] text-[color-mix(in_oklab,var(--status-red)_60%,white)]"
                                : "border-[color-mix(in_oklab,white_10%,transparent)] bg-[color-mix(in_oklab,white_5%,transparent)] text-faint"
                            }`}
                          >
                            {task.dueLabel}
                          </span>
                        )}

                        {task.assignees.length > 0 && (
                          <span className="ml-auto truncate text-[10px] text-faint">
                            {task.assignees.join(", ")}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {createPortal(sheet, document.body)}

      {openTaskId && (
        <TaskDetailSheet
          taskId={openTaskId}
          onClose={() => {
            setOpenTaskId(null);
            // The task may no longer belong in this list — re-read so the
            // count and the rows agree with what was just changed.
            void load();
          }}
        />
      )}
    </>
  );
}
