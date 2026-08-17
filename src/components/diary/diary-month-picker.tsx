"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDaysToKey,
  addMonthsToKey,
  formatIST,
  istKeyToDate,
  istMonthStartKey,
  istWeekStartKey,
} from "@/lib/dates";
import { diaryColorFor } from "@/lib/diary-color";
import { listDiaryDays } from "@/server/actions/diary";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const CELLS = 42;

/**
 * Six weeks of days, Monday first — the same grid the calendar month view lays
 * out, at diary scale. Days that already have a page get a dot in that page's
 * own colour, so paging back through the book is a matter of aiming rather than
 * guessing.
 */
export function DiaryMonthPicker({
  selectedKey,
  todayKey,
  onPick,
  onDismiss,
}: {
  selectedKey: string;
  todayKey: string;
  onPick: (dayKey: string) => void;
  onDismiss: () => void;
}) {
  const [anchorKey, setAnchorKey] = useState(() => istMonthStartKey(selectedKey));
  const [written, setWritten] = useState<Map<string, string>>(new Map());
  const ref = useRef<HTMLDivElement>(null);

  const monthStart = istMonthStartKey(anchorKey);
  const monthEnd = addMonthsToKey(monthStart, 1);
  const gridStart = istWeekStartKey(monthStart);
  const gridEnd = addDaysToKey(gridStart, CELLS - 1);

  useEffect(() => {
    let live = true;

    void (async () => {
      const result = await listDiaryDays(gridStart, gridEnd);
      if (!live || !result.ok) return;
      setWritten(
        new Map(
          result.days.map((d) => [d.dayKey, d.color ?? diaryColorFor(d.dayKey)])
        )
      );
    })();

    return () => {
      live = false;
    };
  }, [gridStart, gridEnd]);

  // Anything outside the card puts it away. The click that opened it is still
  // in flight, so listening starts on the next tick.
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onDismiss();
    };

    const id = window.setTimeout(
      () => window.addEventListener("pointerdown", onPointer),
      0
    );

    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [onDismiss]);

  const days = Array.from({ length: CELLS }, (_, i) => addDaysToKey(gridStart, i));

  return (
    <div
      ref={ref}
      className="overlay absolute right-3 top-14 z-20 w-[16.5rem] p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setAnchorKey(addMonthsToKey(monthStart, -1))}
          className="rounded p-1 text-faint transition-colors hover:text-foreground"
          title="Previous month"
        >
          <ChevronLeft size={14} />
        </button>
        <p className="text-[12px] font-medium">
          {formatIST(istKeyToDate(monthStart, 12), {
            month: "long",
            year: "numeric",
          })}
        </p>
        <button
          type="button"
          onClick={() => setAnchorKey(addMonthsToKey(monthStart, 1))}
          className="rounded p-1 text-faint transition-colors hover:text-foreground"
          title="Next month"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((day, i) => (
          <span
            key={`${day}-${i}`}
            className="text-center text-[10px] uppercase tracking-[0.08em] text-faint"
          >
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days.map((key) => {
          const outside = key < monthStart || key >= monthEnd;
          const selected = key === selectedKey;
          const isToday = key === todayKey;
          const noteColor = written.get(key);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onPick(key)}
              className={`relative flex h-7 flex-col items-center justify-center rounded text-[11px] tabular-nums transition-colors ${
                selected
                  ? "bg-primary text-primary-foreground"
                  : outside
                    ? "text-faint/50 hover:bg-[color-mix(in_oklab,white_5%,transparent)]"
                    : "hover:bg-[color-mix(in_oklab,white_7%,transparent)]"
              } ${isToday && !selected ? "text-brand-cyan" : ""}`}
            >
              {Number(key.slice(8))}
              {noteColor && (
                <span
                  className="absolute bottom-0.5 h-[3px] w-[3px] rounded-full"
                  style={{
                    background: selected
                      ? "var(--primary-foreground)"
                      : noteColor,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onPick(todayKey)}
        className="mt-2 w-full rounded-lg border border-[color-mix(in_oklab,white_10%,transparent)] py-1 text-[11px] text-faint transition-colors hover:text-foreground"
      >
        Jump to today
      </button>
    </div>
  );
}
