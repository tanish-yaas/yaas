"use client";

import { Check, Loader2, SendHorizontal, Trash2 } from "lucide-react";
import type { DiaryPageApi } from "./use-diary-page";

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * The bullets of a page, in the book and in the pinned note alike.
 *
 * `compact` is the sidebar's version: the same rows, tightened, with the push
 * button reduced to its icon because there are 240 pixels to play with.
 */
export function DiaryPoints({
  page,
  canPush,
  compact = false,
  placeholder = "What needs doing today?",
}: {
  page: DiaryPageApi;
  canPush: boolean;
  compact?: boolean;
  placeholder?: string;
}) {
  return (
    <>
      {page.points.map((point, index) => {
        const task = point.taskId ? page.taskById.get(point.taskId) : undefined;
        const pushed = !!point.taskId;
        const busy = page.pushingId === point.id;

        return (
          <div
            key={point.id}
            className={`group flex items-start gap-2 rounded-lg transition-colors hover:bg-[color-mix(in_oklab,white_4%,transparent)] ${
              compact ? "py-0.5 pl-1.5 pr-1" : "py-1 pl-2 pr-1"
            }`}
          >
            <span
              aria-hidden
              className={`dot shrink-0 ${compact ? "mt-[0.45rem]" : "mt-[0.6rem]"}`}
              style={{
                background: task?.done
                  ? "var(--status-green)"
                  : pushed
                    ? "var(--note)"
                    : point.text.trim()
                      ? "color-mix(in oklab, var(--note) 70%, white)"
                      : "var(--border-strong)",
              }}
            />

            <div className="min-w-0 flex-1">
              <textarea
                ref={(el) => {
                  page.registerInput(point.id, el);
                  autoGrow(el);
                }}
                value={point.text}
                rows={1}
                maxLength={page.maxPointChars}
                spellCheck
                placeholder={index === 0 ? placeholder : ""}
                onChange={(e) => {
                  autoGrow(e.currentTarget);
                  page.editPoint(index, e.target.value);
                }}
                onKeyDown={(e) => page.onPointKeyDown(e, index)}
                className={`w-full resize-none overflow-hidden bg-transparent leading-relaxed outline-none placeholder:text-faint ${
                  compact ? "py-0.5 text-[12px]" : "py-1 text-[13px]"
                } ${task?.done ? "text-faint line-through" : ""}`}
              />

              {/* What the point became, as the task reads now. */}
              {pushed && (
                <span className="mb-1 flex min-w-0 items-center gap-1.5 text-[10.5px]">
                  <Check
                    size={9}
                    strokeWidth={3}
                    className="shrink-0"
                    style={{ color: "var(--status-green)" }}
                  />
                  <span className="truncate text-muted-foreground">
                    {task?.title ?? point.taskTitle ?? "Added to tasks"}
                  </span>
                  {task?.dueLabel && (
                    <span
                      className="shrink-0 tabular-nums"
                      style={{
                        color: task.overdue
                          ? "var(--status-red)"
                          : "var(--text-faint)",
                      }}
                    >
                      {task.dueLabel}
                    </span>
                  )}
                  {task?.done && (
                    <span className="shrink-0 text-[var(--status-green)]">
                      done
                    </span>
                  )}
                </span>
              )}
            </div>

            {!pushed && canPush && point.text.trim() && (
              <button
                type="button"
                onClick={() => void page.pushPoint(point)}
                disabled={!!page.pushingId}
                title="Push this point to tasks"
                className="note-push mt-0.5 flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-opacity hover:opacity-85 disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <SendHorizontal size={11} />
                )}
                {!compact && (busy ? "Reading…" : "Push")}
              </button>
            )}

            {!pushed && page.points.length > 1 && (
              <button
                type="button"
                onClick={() => page.removePoint(index)}
                title="Remove this point"
                className="hover-action hover-action--danger mt-1 shrink-0 rounded p-1"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
