"use client";

import { AnimatePresence } from "framer-motion";
import { BookOpen } from "lucide-react";
import { DiaryBook } from "./diary-book";
import { closeDiary, openDiary, useDiaryOpen } from "./diary-store";

/**
 * The button that opens the diary, wherever it is put — the topbar, today.
 *
 * It only asks the store to open; the book itself is mounted once by the shell,
 * so it survives navigation and keeps its position and size while you move
 * around the app.
 */
export function DiaryTrigger({ todayKey }: { todayKey: string }) {
  const openKey = useDiaryOpen();
  const open = openKey !== null;

  return (
    <button
      type="button"
      onClick={() => (open ? closeDiary() : openDiary(todayKey))}
      data-on={open}
      aria-pressed={open}
      title="Diary"
      className="pill"
    >
      <BookOpen size={14} />
      <span className="hidden sm:block">Diary</span>
    </button>
  );
}

/** Holds the one diary window, mounted next to the app shell's own layers. */
export function DiaryDock({
  todayKey,
  canPush,
}: {
  todayKey: string;
  canPush: boolean;
}) {
  const openKey = useDiaryOpen();

  return (
    <AnimatePresence>
      {openKey !== null && (
        <DiaryBook
          key="diary-book"
          dayKey={openKey}
          todayKey={todayKey}
          canPush={canPush}
        />
      )}
    </AnimatePresence>
  );
}
