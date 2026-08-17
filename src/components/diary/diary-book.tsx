"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Maximize2,
  Minimize2,
  Plus,
  X,
} from "lucide-react";
import { useHydrated } from "@/lib/use-hydrated";
import { rootZoom, viewportSize } from "@/lib/ui-scale";
import { addDaysToKey, formatIST, istKeyToDate } from "@/lib/dates";
import { DIARY_COLORS } from "@/lib/diary-color";
import { useDiaryPage } from "./use-diary-page";
import { DiaryPoints } from "./diary-points";
import { DiaryMonthPicker } from "./diary-month-picker";
import { closeDiary, openDiary } from "./diary-store";

const EASE = [0.16, 1, 0.3, 1] as const;
const MIN_WIDTH = 340;
const MIN_HEIGHT = 300;
/** Enough of the window must stay on screen to be grabbed again. */
const KEEP_VISIBLE = 180;
const MARGIN = 16;

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Where the book opens: centred, and big — most of the window, short of filling
 * it. Measured through viewportSize() so it lands in the same coordinate space
 * the fixed element is positioned in, whatever the interface scale is.
 */
function openingRect(): Rect {
  const view = viewportSize();
  const w = Math.max(MIN_WIDTH, Math.min(980, view.width - 2 * MARGIN));
  const h = Math.max(MIN_HEIGHT, Math.min(820, view.height - 2 * MARGIN));
  return {
    x: Math.max(MARGIN, (view.width - w) / 2),
    y: Math.max(MARGIN, (view.height - h) / 2),
    w,
    h,
  };
}

function clampRect(rect: Rect): Rect {
  const view = viewportSize();
  const w = Math.min(rect.w, view.width - 2 * MARGIN);
  const h = Math.min(rect.h, view.height - 2 * MARGIN);
  return {
    w: Math.max(MIN_WIDTH, w),
    h: Math.max(MIN_HEIGHT, h),
    x: Math.min(Math.max(rect.x, KEEP_VISIBLE - w), view.width - KEEP_VISIBLE),
    // The header must never go above the top edge, or it can't be grabbed.
    y: Math.min(Math.max(rect.y, 0), view.height - 48),
  };
}

export function DiaryBook({
  dayKey,
  todayKey,
  canPush,
}: {
  /** Which page is open, straight from the store — the book keeps no copy, so
      opening it from elsewhere can change the page under it. */
  dayKey: string;
  todayKey: string;
  canPush: boolean;
}) {
  const hydrated = useHydrated();
  const [rect, setRect] = useState<Rect>(() =>
    typeof window === "undefined"
      ? { x: MARGIN, y: MARGIN, w: MIN_WIDTH, h: MIN_HEIGHT }
      : openingRect()
  );
  /** Where to go back to when un-maximising — and the fact that we can. */
  const [restoreRect, setRestoreRect] = useState<Rect | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  /** Which way the last page turn went, so the new page slides in behind it. */
  const [direction, setDirection] = useState(1);

  const page = useDiaryPage(dayKey);
  const maximized = restoreRect !== null;

  const close = useCallback(async () => {
    if (page.isPending()) await page.flush();
    closeDiary();
  }, [page]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (pickerOpen || colorsOpen) {
        setPickerOpen(false);
        setColorsOpen(false);
        return;
      }
      void close();
    }

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close, pickerOpen, colorsOpen]);

  // A window narrowed under the book would otherwise leave it off screen.
  useEffect(() => {
    const onResize = () => setRect((prev) => clampRect(prev));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /**
   * Drag and resize share this. Pointer coordinates come back in screen pixels
   * while the book is positioned in the zoomed root's pixels, so every delta is
   * divided by the root scale — see lib/ui-scale.ts.
   */
  function trackPointer(
    event: React.PointerEvent,
    onMove: (dx: number, dy: number, start: Rect) => Rect
  ) {
    if (event.button !== 0) return;
    event.preventDefault();

    const target = event.currentTarget as HTMLElement;
    const zoom = rootZoom();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = rect;
    let moved = false;

    target.setPointerCapture(event.pointerId);

    const move = (e: PointerEvent) => {
      const dx = (e.clientX - startX) / zoom;
      const dy = (e.clientY - startY) / zoom;

      // A click that wobbles is still a click — and it must not cost the size
      // the window would go back to, or double-click-to-restore breaks.
      if (!moved) {
        if (Math.abs(dx) + Math.abs(dy) < 3) return;
        moved = true;
        setRestoreRect(null);
      }

      setRect(clampRect(onMove(dx, dy, start)));
    };

    const up = () => {
      target.releasePointerCapture(event.pointerId);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };

    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }

  function onDragStart(event: React.PointerEvent) {
    trackPointer(event, (dx, dy, start) => ({
      ...start,
      x: start.x + dx,
      y: start.y + dy,
    }));
  }

  function onResizeStart(event: React.PointerEvent) {
    trackPointer(event, (dx, dy, start) => ({
      ...start,
      w: start.w + dx,
      h: start.h + dy,
    }));
  }

  function toggleMaximize() {
    if (restoreRect) {
      setRestoreRect(null);
      setRect(clampRect(restoreRect));
      return;
    }

    setRestoreRect(rect);
    const view = viewportSize();
    setRect({
      x: MARGIN,
      y: MARGIN,
      w: view.width - 2 * MARGIN,
      h: view.height - 2 * MARGIN,
    });
  }

  /** Save what is open, then turn to another page. */
  async function goTo(nextKey: string, turn: number) {
    setPickerOpen(false);
    if (nextKey === dayKey) return;
    if (page.isPending()) await page.flush();
    setDirection(turn);
    openDiary(nextKey);
  }

  if (!hydrated) return null;

  const written = page.points.filter((p) => p.text.trim()).length;
  const pushedCount = page.points.filter((p) => p.taskId).length;
  const isToday = dayKey === todayKey;

  const book = (
    <motion.div
      role="dialog"
      aria-label="Diary"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.24, ease: EASE }}
      style={
        {
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          "--note": page.color,
        } as React.CSSProperties
      }
      className="note-surface fixed z-[98] flex flex-col overflow-hidden"
    >
      <div aria-hidden className="note-edge h-1 shrink-0" />

      <header
        onPointerDown={onDragStart}
        onDoubleClick={toggleMaximize}
        className="flex shrink-0 cursor-grab touch-none select-none items-center gap-2 border-b border-[color-mix(in_oklab,white_8%,transparent)] px-3 py-2.5 active:cursor-grabbing"
      >
        <GripVertical size={13} className="shrink-0 text-faint" />
        <BookOpen size={14} className="shrink-0" style={{ color: page.color }} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium">
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
            {page.save !== "clean" && (
              <span
                className={
                  page.save === "failed" ? "text-destructive" : undefined
                }
              >
                {" · "}
                {page.save === "saving"
                  ? "Saving…"
                  : page.save === "dirty"
                    ? "Unsaved"
                    : page.save === "failed"
                      ? "Save failed"
                      : "Saved"}
              </span>
            )}
          </p>
        </div>

        {/* Everything in the bar is a control, so none of it should start a
            drag — the header's own handler is what moves the window. */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="flex shrink-0 items-center gap-1"
        >
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => setColorsOpen((prev) => !prev)}
              title="Note colour"
              className="note-swatch mr-1"
              style={{ background: page.color }}
              data-on={colorsOpen}
            />
            {colorsOpen && (
              <div className="overlay absolute right-0 top-6 z-10 flex gap-1.5 p-2">
                {DIARY_COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => {
                      page.setColor(swatch);
                      setColorsOpen(false);
                    }}
                    data-on={swatch === page.color}
                    title={swatch}
                    className="note-swatch"
                    style={{ background: swatch }}
                  />
                ))}
              </div>
            )}
          </div>

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
            className="rounded p-1.5 text-faint transition-colors hover:text-foreground data-[on=true]:text-foreground"
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
            onClick={toggleMaximize}
            title={maximized ? "Restore size" : "Fill the screen"}
            className="rounded p-1.5 text-faint transition-colors hover:text-foreground"
          >
            {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            type="button"
            onClick={() => void close()}
            title="Close the diary"
            className="rounded p-1.5 text-faint transition-colors hover:text-foreground"
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
          className="pointer-events-none absolute bottom-0 left-[2.15rem] top-0 w-px"
          style={{
            background: "color-mix(in oklab, var(--note) 30%, transparent)",
          }}
        />

        <motion.div
          key={dayKey}
          initial={{ opacity: 0, x: 22 * direction }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.26, ease: EASE }}
          className="px-3 py-3"
        >
          {page.loading ? (
            <p className="px-8 py-6 text-[12px] text-faint">Opening…</p>
          ) : (
            <DiaryPoints page={page} canPush={canPush} />
          )}
        </motion.div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[color-mix(in_oklab,white_8%,transparent)] px-4 py-2.5">
        <button
          type="button"
          onClick={() => page.addPointAfter(page.points.length - 1)}
          className="flex items-center gap-1.5 text-[12px] text-faint transition-colors hover:text-foreground"
        >
          <Plus size={13} />
          Add point
        </button>
        <p className="hidden text-[11px] text-faint sm:block">
          Shift + Enter for the next point
          {canPush ? " · Push turns one into a task" : ""}
        </p>
      </footer>

      {/* Resize corner. Sized generously — a 6px target is a bad joke. */}
      <div
        onPointerDown={onResizeStart}
        title="Resize"
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
        style={{
          background:
            "linear-gradient(135deg, transparent 46%, color-mix(in oklab, var(--note) 55%, transparent) 46%)",
        }}
      />
    </motion.div>
  );

  return createPortal(book, document.body);
}
