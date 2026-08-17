"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Target } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion/fade-in";
import { EmptyState } from "@/components/ui/empty-state";
import { useHydrated } from "@/lib/use-hydrated";
import { TaskRow, type TaskRowData } from "./task-row";
import { DiaryButton } from "./diary-book";
import type { LabelOption } from "./label-picker";

const KEY = "yaas.tasks.focus";
const EASE = [0.16, 1, 0.3, 1] as const;

// Focus mode outlives a reload, so localStorage is the source of truth and the
// component subscribes to it. Reading it in a mount effect would work too, but
// setState inside an effect cascades an extra render on every visit.
const watchers = new Set<() => void>();

function subscribeFocus(notify: () => void) {
  watchers.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    watchers.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

function readFocus() {
  return window.localStorage.getItem(KEY) === "1";
}

function writeFocus(next: boolean) {
  window.localStorage.setItem(KEY, next ? "1" : "0");
  // `storage` only fires in *other* tabs — this one has to tell itself.
  for (const notify of [...watchers]) notify();
}

const alwaysFalse = () => false;

export function FocusZone({
  todayTasks,
  overdueCount,
  doneToday,
  dateLabel,
  openCount,
  doneCount,
  allLabels,
  todayKey,
  canPush,
  children,
}: {
  /** Everything today is asking for: overdue first, then due before midnight. */
  todayTasks: TaskRowData[];
  /** How many of those slipped from an earlier day. */
  overdueCount: number;
  /** Tasks actually finished today — the numerator of the progress meter. */
  doneToday: number;
  dateLabel: string;
  openCount: number;
  doneCount: number;
  allLabels: LabelOption[];
  /** Today in IST, for the diary's opening page. */
  todayKey: string;
  /** Whether this member may run the parser behind the diary's push button. */
  canPush: boolean;
  /** The full, unfiltered page. Rendered whenever focus mode is off. */
  children: React.ReactNode;
}) {
  const on = useSyncExternalStore(subscribeFocus, readFocus, alwaysFalse);
  // The aura portals into document.body, which only exists once hydrated.
  const mounted = useHydrated();

  const toggle = useCallback((next: boolean) => writeFocus(next), []);

  // The shell dims its own chrome in focus mode, and it sits above this
  // component in the tree — a flag on the root element is the only handle the
  // two share. Cleared on unmount so navigating away always restores it.
  useEffect(() => {
    if (on) document.documentElement.dataset.focus = "true";
    else delete document.documentElement.dataset.focus;
    return () => {
      delete document.documentElement.dataset.focus;
    };
  }, [on]);

  useEffect(() => {
    if (!on) return;

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      // Escape belongs to whatever is on top — an open menu, or a field mid-edit.
      // Only an otherwise-idle Escape leaves focus mode.
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (document.querySelector(".overlay")) return;

      toggle(false);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on, toggle]);

  const total = todayTasks.length + doneToday;
  const percent = total === 0 ? 0 : (doneToday / total) * 100;

  return (
    <>
      {/* Edge light. Portalled to body because the shell's blurred surfaces
          would otherwise trap a fixed layer inside a card. */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {on && (
              <motion.div
                key="focus-aura"
                className="focus-aura"
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>,
          document.body
        )}

      <header className="mb-6 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            {on ? (
              <motion.div
                key="head-focus"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.24, ease: EASE }}
              >
                <h1 className="text-2xl font-semibold">
                  <span className="text-gradient">Focus</span>
                </h1>
                <p className="mt-0.5 text-[13px] text-faint">
                  {dateLabel} · {todayTasks.length} left
                  {doneToday > 0 ? ` · ${doneToday} done today` : ""}
                  {overdueCount > 0 && (
                    <>
                      {" · "}
                      <span style={{ color: "var(--status-red)" }}>
                        {overdueCount} overdue
                      </span>
                    </>
                  )}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="head-all"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.24, ease: EASE }}
              >
                <h1 className="text-2xl font-semibold">Tasks</h1>
                <p className="mt-0.5 text-[13px] text-faint">
                  {openCount} open · {doneCount} done
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {on && (
            <span className="hidden text-[11px] text-faint sm:inline">
              Esc to exit
            </span>
          )}
          <DiaryButton todayKey={todayKey} canPush={canPush} />
          <button
            type="button"
            onClick={() => toggle(!on)}
            data-on={on}
            aria-pressed={on}
            title={
              on ? "Leave focus mode" : "Focus on what is due today"
            }
            className="pill pill-sm"
          >
            <Target size={13} className={on ? "focus-pulse" : undefined} />
            {on ? "Focusing" : "Focus"}
          </button>
        </div>
      </header>

      {on && total > 0 && (
        <motion.div
          initial={{ opacity: 0, scaleX: 0.9 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="mb-5 h-[3px] w-full origin-left overflow-hidden rounded-full bg-[color-mix(in_oklab,white_8%,transparent)]"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-violet to-brand-cyan transition-[width] duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </motion.div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {on ? (
          <motion.div
            key="body-focus"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="mx-auto w-full max-w-2xl"
          >
            <div className="focus-panel px-1.5 py-1">
              {todayTasks.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="Nothing left for today"
                  description="Nothing is overdue and nothing else is due before midnight. Leave focus mode to plan ahead."
                />
              ) : (
                <Stagger>
                  {todayTasks.map((task) => (
                    <StaggerItem
                      key={task.id}
                      className="border-b border-border last:border-0"
                    >
                      <TaskRow task={task} allLabels={allLabels} />
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="body-all"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
