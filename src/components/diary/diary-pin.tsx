"use client";

import { Maximize2, Plus, StickyNote } from "lucide-react";
import { formatIST, istKeyToDate } from "@/lib/dates";
import { useDiaryPage } from "./use-diary-page";
import { DiaryPoints } from "./diary-points";
import { openDiary } from "./diary-store";

/**
 * Today's page, pinned to the bottom of the sidebar in its own colour.
 *
 * The same editable page as the book — not a preview of it — so a line can be
 * added, changed or pushed without opening anything. Whichever copy saves tells
 * the other, so the two never drift apart.
 */
export function DiaryPin({
  todayKey,
  canPush,
}: {
  todayKey: string;
  canPush: boolean;
}) {
  const page = useDiaryPage(todayKey);
  const pushedCount = page.points.filter((p) => p.taskId).length;
  const written = page.points.filter((p) => p.text.trim()).length;

  return (
    <div
      className="note-pinned mt-5 flex shrink-0 flex-col overflow-hidden"
      style={{ "--note": page.color } as React.CSSProperties}
    >
      <div aria-hidden className="note-edge h-[3px] shrink-0" />

      <div className="flex shrink-0 items-center gap-1.5 px-2.5 pb-1 pt-2">
        <StickyNote size={12} className="shrink-0" style={{ color: page.color }} />
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium">
          {formatIST(istKeyToDate(todayKey, 12), {
            day: "numeric",
            month: "short",
          })}
          <span className="ml-1 text-faint">
            {written > 0 ? `· ${written}` : ""}
            {pushedCount > 0 ? ` · ${pushedCount}↑` : ""}
          </span>
        </p>
        <button
          type="button"
          onClick={() => openDiary(todayKey)}
          title="Open the diary"
          className="shrink-0 rounded p-1 text-faint transition-colors hover:text-foreground"
        >
          <Maximize2 size={11} />
        </button>
      </div>

      {/* No inner scroller: the note is as tall as its points, and the sidebar
          is what scrolls when there are more of them than there is sidebar. */}
      <div className="px-1 pb-1">
        {page.loading ? (
          <p className="px-2 py-2 text-[11px] text-faint">Opening…</p>
        ) : (
          <DiaryPoints
            page={page}
            canPush={canPush}
            compact
            placeholder="Jot something down…"
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => page.addPointAfter(page.points.length - 1)}
        className="flex shrink-0 items-center gap-1 border-t border-[color-mix(in_oklab,white_7%,transparent)] px-2.5 py-1.5 text-[11px] text-faint transition-colors hover:text-foreground"
      >
        <Plus size={11} />
        Add point
      </button>
    </div>
  );
}
