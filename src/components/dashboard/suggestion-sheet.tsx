"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertOctagon,
  ArrowUpRight,
  Check,
  Flag,
  Loader2,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  acceptSuggestion,
  dismissSuggestion,
  getSuggestionDetail,
  type SuggestionDetail,
} from "@/server/actions/suggestions";
import { accentForSuggestion, iconForSuggestion } from "./suggestion-style";

// Same reasoning as the board: the detail sheet is the largest component in the
// app, and most sessions never open a suggestion. Kept out of the entry chunk.
const TaskDetailSheet = dynamic(
  () =>
    import("@/components/tasks/task-detail-sheet").then(
      (m) => m.TaskDetailSheet
    ),
  { ssr: false }
);

const STATUS_LABEL: Record<string, string> = {
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
 * The expanded form of a suggestion: the whole reason rather than a clamped
 * line, what accepting would actually write, and the task it is about — so the
 * decision can be made here instead of on a rail card with two buttons and no
 * context.
 *
 * Portalled to the body. The panel classes set backdrop-filter, which traps
 * fixed positioning in a descendant.
 */
export function SuggestionSheet({
  suggestionId,
  onClose,
  onResolved,
}: {
  suggestionId: string | null;
  onClose: () => void;
  /** Fires after accept or dismiss, so the opener can drop the row. */
  onResolved?: (suggestionId: string) => void;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [mounted, setMounted] = useState(false);
  const [detail, setDetail] = useState<SuggestionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    if (!suggestionId) return;
    setLoading(true);
    const result = await getSuggestionDetail(suggestionId);
    setLoading(false);

    if (!result.ok) {
      push(result.error, "error");
      onClose();
      return;
    }
    setDetail(result.detail);
  }, [suggestionId, onClose, push]);

  useEffect(() => {
    if (!suggestionId) {
      setDetail(null);
      return;
    }
    void load();
  }, [suggestionId, load]);

  useEffect(() => {
    if (!suggestionId) return;
    const onKey = (e: KeyboardEvent) => {
      // The task sheet stacks on top of this one and owns Escape while open.
      if (e.key === "Escape" && !openTaskId) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [suggestionId, onClose, openTaskId]);

  function resolve(action: () => Promise<{ ok: boolean; error?: string }>) {
    const id = suggestionId;
    startTransition(async () => {
      const result = await action();
      if (!result.ok && result.error) {
        push(result.error, "error");
        return;
      }
      if (id) onResolved?.(id);
      onClose();
      router.refresh();
    });
  }

  if (!mounted) return null;

  const accent = detail ? accentForSuggestion(detail.type) : "var(--primary)";
  const task = detail?.task;

  const sheet = (
    <AnimatePresence>
      {suggestionId && (
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
            aria-label="Suggestion"
            className="fixed inset-y-0 right-0 z-[89] flex w-full flex-col border-l border-border bg-card sm:w-[28rem]"
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0" style={{ color: accent }}>
                  {detail ? (
                    iconForSuggestion(detail.type, 14)
                  ) : (
                    <Sparkles size={14} />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-faint">
                    Suggestion
                  </p>
                  <p className="mt-0.5 truncate text-[13px]">
                    {detail?.type.replace(/_/g, " ").toLowerCase() ?? "Loading…"}
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
              {loading && !detail && (
                <div className="flex items-center gap-2 py-10 text-[12px] text-faint">
                  <Loader2 size={14} className="animate-spin" />
                  Loading suggestion…
                </div>
              )}

              {detail && (
                <>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {detail.reason}
                  </p>

                  {detail.confidence !== null && (
                    <p className="mt-2 text-[11px] text-faint">
                      {Math.round(detail.confidence * 100)}% sure
                    </p>
                  )}

                  {detail.effect && (
                    <div
                      className="mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5"
                      style={{
                        borderColor: `color-mix(in oklab, ${accent} 35%, transparent)`,
                        backgroundColor: `color-mix(in oklab, ${accent} 8%, transparent)`,
                      }}
                    >
                      <Wand2
                        size={13}
                        className="mt-0.5 shrink-0"
                        style={{ color: accent }}
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-faint">
                          If you accept
                        </p>
                        <p className="mt-0.5 text-[12px] leading-relaxed">
                          {detail.effect}
                        </p>
                      </div>
                    </div>
                  )}

                  {detail.taskHidden && (
                    <p className="mt-4 text-[12px] text-faint">
                      This is about a task you can&apos;t see.
                    </p>
                  )}

                  {task && (
                    <section className="mt-6">
                      <h3 className="mb-2 text-[10px] uppercase tracking-[0.12em] text-faint">
                        The task
                      </h3>

                      <button
                        type="button"
                        onClick={() => setOpenTaskId(task.id)}
                        className="group w-full rounded-xl border border-[color-mix(in_oklab,white_9%,transparent)] bg-[color-mix(in_oklab,white_2%,transparent)] px-3.5 py-3 text-left transition-colors hover:border-[color-mix(in_oklab,white_18%,transparent)]"
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

                        {task.description && (
                          <p className="mt-1.5 line-clamp-2 pl-4 text-[12px] leading-relaxed text-faint">
                            {task.description}
                          </p>
                        )}

                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-4">
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
                              {task.overdue ? "Overdue · " : "Due "}
                              {task.dueLabel}
                            </span>
                          )}

                          {task.subtaskCount > 0 && (
                            <span className="chip border-[color-mix(in_oklab,white_10%,transparent)] bg-[color-mix(in_oklab,white_5%,transparent)] tabular-nums text-faint">
                              {task.doneSubtaskCount}/{task.subtaskCount} done
                            </span>
                          )}

                          {task.labels.map((label) => (
                            <span
                              key={label.id}
                              className="chip"
                              style={{
                                backgroundColor: `color-mix(in oklab, ${label.color} 20%, transparent)`,
                                borderColor: `color-mix(in oklab, ${label.color} 40%, transparent)`,
                                color: `color-mix(in oklab, ${label.color} 55%, white)`,
                              }}
                            >
                              {label.name}
                            </span>
                          ))}
                        </div>

                        {task.assignees.length > 0 && (
                          <p className="mt-2 pl-4 text-[11px] text-faint">
                            {task.assignees.join(", ")}
                          </p>
                        )}
                      </button>

                      {task.roadblock && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg border border-[color-mix(in_oklab,var(--status-red)_35%,transparent)] bg-[color-mix(in_oklab,var(--status-red)_8%,transparent)] px-3 py-2.5">
                          <AlertOctagon
                            size={13}
                            className="mt-0.5 shrink-0 text-[var(--status-red)]"
                          />
                          <p className="text-[12px] leading-relaxed text-muted-foreground">
                            {task.roadblock}
                          </p>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setOpenTaskId(task.id)}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] text-faint transition-colors hover:bg-[color-mix(in_oklab,white_5%,transparent)] hover:text-foreground"
                      >
                        <Flag size={12} />
                        Open the full task
                      </button>
                    </section>
                  )}
                </>
              )}
            </div>

            {detail && (
              <footer className="flex shrink-0 items-center gap-2 border-t border-border/60 px-5 py-4">
                {detail.actionable && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => resolve(() => acceptSuggestion(detail.id))}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Check size={12} />
                    {pending ? "Doing it…" : "Do it"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => resolve(() => dismissSuggestion(detail.id))}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] text-faint transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <X size={12} />
                  No thanks
                </button>
              </footer>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {createPortal(sheet, document.body)}

      {/* Stacked above this sheet rather than replacing it, so closing the task
          returns you to the suggestion you were deciding on. */}
      {openTaskId && (
        <TaskDetailSheet
          taskId={openTaskId}
          onClose={() => {
            setOpenTaskId(null);
            // The task may have moved under the suggestion — re-read it so the
            // preview and the "if you accept" line are not stale.
            void load();
          }}
        />
      )}
    </>
  );
}
