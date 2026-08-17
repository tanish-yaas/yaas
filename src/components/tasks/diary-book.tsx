"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  SendHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useHydrated } from "@/lib/use-hydrated";
import { addDaysToKey, formatIST, istKeyToDate } from "@/lib/dates";
import { APP_CONFIG } from "@/config/app";
import {
  loadDiaryPage,
  pushDiaryPoint,
  saveDiaryPage,
} from "@/server/actions/diary";
import type { DiaryPoint } from "@/lib/validators/diary";
import { DiaryMonthPicker } from "./diary-month-picker";

const EASE = [0.16, 1, 0.3, 1] as const;
const SAVE_DEBOUNCE_MS = 900;
const { maxPoints, maxPointChars } = APP_CONFIG.diary;

type SaveState = "clean" | "dirty" | "saving" | "saved" | "failed";

function blankPoint(): DiaryPoint {
  return { id: crypto.randomUUID(), text: "", taskId: null, taskTitle: null };
}

/** A page always offers a line to write on, even when it is empty. */
function withRoom(points: DiaryPoint[]): DiaryPoint[] {
  return points.length > 0 ? points : [blankPoint()];
}

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function DiaryButton({
  todayKey,
  canPush,
}: {
  todayKey: string;
  /** Pushing a point runs the parser, so it needs ai.use. */
  canPush: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-on={open}
        aria-pressed={open}
        title="Open the diary"
        className="pill pill-sm"
      >
        <BookOpen size={13} />
        Diary
      </button>

      <AnimatePresence>
        {open && (
          <DiaryModal
            todayKey={todayKey}
            canPush={canPush}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function DiaryModal({
  todayKey,
  canPush,
  onClose,
}: {
  todayKey: string;
  canPush: boolean;
  onClose: () => void;
}) {
  const hydrated = useHydrated();
  const { push } = useToast();

  const [dayKey, setDayKey] = useState(todayKey);
  const [points, setPoints] = useState<DiaryPoint[]>(() => [blankPoint()]);
  /** Which day the points on screen belong to — anything else is still loading. */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("clean");
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  /** Which way the last page turn went, so the new page slides in behind it. */
  const [direction, setDirection] = useState(1);

  // The debounced save fires after the state it is saving may have moved on, so
  // it reads the page from refs rather than from the closure it was created in.
  const pointsRef = useRef(points);
  const dayKeyRef = useRef(dayKey);
  const timer = useRef<number | null>(null);
  const inputs = useRef(new Map<string, HTMLTextAreaElement>());

  const flush = useCallback(async () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }

    const snapshot = pointsRef.current;
    const key = dayKeyRef.current;

    setSave("saving");
    const result = await saveDiaryPage(key, snapshot);

    if (!result.ok) {
      setSave("failed");
      push(result.error, "error");
      return false;
    }

    setSave("saved");
    return true;
  }, [push]);

  const schedule = useCallback(() => {
    setSave("dirty");
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
  }, [flush]);

  /** Every edit goes through here: state, the ref the saver reads, and the clock. */
  const commit = useCallback(
    (next: DiaryPoint[]) => {
      pointsRef.current = next;
      setPoints(next);
      schedule();
    },
    [schedule]
  );

  useEffect(() => {
    let live = true;

    void (async () => {
      const result = await loadDiaryPage(dayKey);
      if (!live) return;

      if (!result.ok) {
        push(result.error, "error");
        setLoadedKey(dayKey);
        return;
      }

      const loaded = withRoom(result.points);
      pointsRef.current = loaded;
      dayKeyRef.current = dayKey;
      setPoints(loaded);
      setSave("clean");
      setLoadedKey(dayKey);
    })();

    return () => {
      live = false;
    };
  }, [dayKey, push]);

  // A page half-written when the tab closes is still worth keeping.
  useEffect(() => {
    const onHide = () => {
      if (timer.current === null) return;
      void flush();
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, [flush]);

  const close = useCallback(async () => {
    if (timer.current !== null) await flush();
    onClose();
  }, [flush, onClose]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (pickerOpen) {
        setPickerOpen(false);
        return;
      }
      void close();
    }

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, pickerOpen]);

  /** Save what is open, then turn to another page. */
  async function goTo(nextKey: string, turn: number) {
    if (nextKey === dayKeyRef.current) {
      setPickerOpen(false);
      return;
    }
    if (timer.current !== null) await flush();
    setDirection(turn);
    setPickerOpen(false);
    setDayKey(nextKey);
  }

  function focusPoint(id: string, caretAtEnd = false) {
    requestAnimationFrame(() => {
      const el = inputs.current.get(id);
      if (!el) return;
      el.focus();
      if (caretAtEnd) el.setSelectionRange(el.value.length, el.value.length);
    });
  }

  function addPointAfter(index: number) {
    if (points.length >= maxPoints) {
      push(`A page holds ${maxPoints} points`, "error");
      return;
    }
    const fresh = blankPoint();
    const next = [...points];
    next.splice(index + 1, 0, fresh);
    commit(next);
    focusPoint(fresh.id);
  }

  function removePoint(index: number) {
    const next = points.filter((_, i) => i !== index);
    commit(withRoom(next));
    const previous = next[Math.max(0, index - 1)];
    if (previous) focusPoint(previous.id, true);
  }

  function editPoint(index: number, text: string) {
    commit(
      points.map((p, i) =>
        i === index ? { ...p, text: text.slice(0, maxPointChars) } : p
      )
    );
  }

  function onPointKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    index: number
  ) {
    const el = event.currentTarget;

    // Shift + Enter is the asked-for way to start the next point; plain Enter
    // does the same, because a bullet is one line by definition.
    if (event.key === "Enter") {
      event.preventDefault();
      addPointAfter(index);
      return;
    }

    if (
      event.key === "Backspace" &&
      el.value === "" &&
      !points[index].taskId &&
      points.length > 1
    ) {
      event.preventDefault();
      removePoint(index);
      return;
    }

    // Only leave the line when the caret has nowhere left to go inside it.
    if (event.key === "ArrowUp" && el.selectionStart === 0 && index > 0) {
      event.preventDefault();
      focusPoint(points[index - 1].id, true);
      return;
    }

    if (
      event.key === "ArrowDown" &&
      el.selectionStart === el.value.length &&
      index < points.length - 1
    ) {
      event.preventDefault();
      focusPoint(points[index + 1].id, true);
    }
  }

  async function pushPoint(point: DiaryPoint) {
    if (pushingId || point.taskId || !point.text.trim()) return;

    setPushingId(point.id);

    // The server reads the point off the saved page, so what is on screen has
    // to be on the page first.
    const saved = timer.current !== null ? await flush() : true;
    if (!saved) {
      setPushingId(null);
      return;
    }

    const result = await pushDiaryPoint(dayKeyRef.current, point.id);
    setPushingId(null);

    if (!result.ok) {
      push(result.error, "error");
      return;
    }

    const stamped = pointsRef.current.map((p) =>
      p.id === point.id
        ? { ...p, taskId: result.taskId, taskTitle: result.title }
        : p
    );
    // Straight to state: the server already stamped the stored page, so
    // scheduling another save would only write back what it just wrote.
    pointsRef.current = stamped;
    setPoints(stamped);
    setSave("saved");

    push(result.dueLabel ? `Added · due ${result.dueLabel}` : "Added to tasks");
  }

  if (!hydrated) return null;

  const loading = loadedKey !== dayKey;
  const pushedCount = points.filter((p) => p.taskId).length;
  const written = points.filter((p) => p.text.trim()).length;
  const isToday = dayKey === todayKey;

  const panel = (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => void close()}
        className="fixed inset-0 z-[97] bg-black/55"
      />

      <motion.div
        role="dialog"
        aria-label="Diary"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.985 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="overlay fixed left-1/2 top-[calc(0.07*var(--vh))] z-[98] flex max-h-[calc(0.86*var(--vh))] w-[min(44rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col overflow-hidden"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-3">
          <BookOpen size={15} className="shrink-0 text-brand-violet" />

          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium">
              {formatIST(istKeyToDate(dayKey, 12), {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {isToday && (
                <span className="chip chip-accent ml-2 align-middle">Today</span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-faint">
              {written} {written === 1 ? "point" : "points"}
              {pushedCount > 0 ? ` · ${pushedCount} pushed` : ""}
              {/* Nothing to report on a page that has not been touched yet. */}
              {save !== "clean" && (
                <span
                  className={save === "failed" ? "text-destructive" : undefined}
                >
                  {" · "}
                  {save === "saving"
                    ? "Saving…"
                    : save === "dirty"
                      ? "Unsaved"
                      : save === "failed"
                        ? "Save failed"
                        : "Saved"}
                </span>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => void goTo(addDaysToKey(dayKey, -1), -1)}
              title="Previous day"
              className="rounded p-1.5 text-faint transition-colors hover:text-foreground"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen((prev) => !prev)}
              data-on={pickerOpen}
              title="Pick a date"
              className="rounded p-1.5 text-faint transition-colors hover:text-foreground data-[on=true]:text-brand-violet"
            >
              <CalendarDays size={15} />
            </button>
            <button
              type="button"
              onClick={() => void goTo(addDaysToKey(dayKey, 1), 1)}
              title="Next day"
              className="rounded p-1.5 text-faint transition-colors hover:text-foreground"
            >
              <ChevronRight size={15} />
            </button>
            <button
              type="button"
              onClick={() => void close()}
              title="Close"
              className="ml-1 rounded p-1.5 text-faint transition-colors hover:text-foreground"
            >
              <X size={15} />
            </button>
          </div>
        </header>

        {pickerOpen && (
          <DiaryMonthPicker
            selectedKey={dayKey}
            todayKey={todayKey}
            onPick={(key) => void goTo(key, key > dayKey ? 1 : -1)}
            onDismiss={() => setPickerOpen(false)}
          />
        )}

        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {/* The margin rule of a ruled page — decoration, so it stays behind. */}
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-[2.15rem] top-0 w-px bg-[color-mix(in_oklab,var(--status-red)_22%,transparent)]"
          />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={dayKey}
              initial={{ opacity: 0, x: 22 * direction }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 * direction }}
              transition={{ duration: 0.26, ease: EASE }}
              className="px-3 py-3"
            >
              {loading ? (
                <p className="px-8 py-6 text-[12px] text-faint">Opening…</p>
              ) : (
                points.map((point, index) => {
                  const pushed = !!point.taskId;
                  const busy = pushingId === point.id;

                  return (
                    <div
                      key={point.id}
                      className="group flex items-start gap-2 rounded-lg py-1 pl-2 pr-1 transition-colors hover:bg-[color-mix(in_oklab,white_3%,transparent)]"
                    >
                      <span
                        aria-hidden
                        className="dot mt-[0.6rem] shrink-0"
                        style={{
                          background: pushed
                            ? "var(--status-green)"
                            : point.text.trim()
                              ? "var(--brand-violet)"
                              : "var(--border-strong)",
                        }}
                      />

                      <div className="min-w-0 flex-1">
                        <textarea
                          ref={(el) => {
                            if (el) {
                              inputs.current.set(point.id, el);
                              autoGrow(el);
                            } else {
                              inputs.current.delete(point.id);
                            }
                          }}
                          value={point.text}
                          rows={1}
                          maxLength={maxPointChars}
                          spellCheck
                          placeholder={
                            index === 0 ? "What needs doing today?" : ""
                          }
                          onChange={(e) => {
                            autoGrow(e.currentTarget);
                            editPoint(index, e.target.value);
                          }}
                          onKeyDown={(e) => onPointKeyDown(e, index)}
                          className={`w-full resize-none overflow-hidden bg-transparent py-1 text-[13px] leading-relaxed outline-none placeholder:text-faint ${
                            pushed ? "text-muted-foreground" : ""
                          }`}
                        />

                        {pushed && (
                          <span className="mb-1 inline-flex items-center gap-1 text-[11px] text-[var(--status-green)]">
                            <Check size={10} strokeWidth={3} />
                            <span className="truncate">
                              {point.taskTitle ?? "Added to tasks"}
                            </span>
                          </span>
                        )}
                      </div>

                      {!pushed && canPush && point.text.trim() && (
                        <button
                          type="button"
                          onClick={() => void pushPoint(point)}
                          disabled={!!pushingId}
                          title="Push this point to tasks"
                          className="mt-0.5 flex shrink-0 items-center gap-1 rounded-lg border border-[color-mix(in_oklab,var(--primary)_35%,transparent)] bg-[color-mix(in_oklab,var(--primary)_14%,transparent)] px-2 py-1 text-[11px] text-[color-mix(in_oklab,var(--primary)_72%,white)] transition-opacity hover:opacity-85 disabled:opacity-40"
                        >
                          {busy ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <SendHorizontal size={11} />
                          )}
                          {busy ? "Reading…" : "Push"}
                        </button>
                      )}

                      {!pushed && points.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePoint(index)}
                          title="Remove this point"
                          className="hover-action hover-action--danger mt-1 shrink-0 rounded p-1"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[color-mix(in_oklab,white_7%,transparent)] px-4 py-2.5">
          <button
            type="button"
            onClick={() => addPointAfter(points.length - 1)}
            className="flex items-center gap-1.5 text-[12px] text-faint transition-colors hover:text-foreground"
          >
            <Plus size={13} />
            Add point
          </button>
          <p className="text-[11px] text-faint">
            Shift + Enter for the next point
            {canPush ? " · Push turns one into a task" : ""}
          </p>
        </footer>
      </motion.div>
    </>
  );

  return createPortal(panel, document.body);
}
