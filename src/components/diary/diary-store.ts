"use client";

import { useSyncExternalStore } from "react";

/**
 * Two bits of diary state that live outside React's tree, because the parts
 * that need them are nowhere near each other: the topbar button and the sidebar
 * note both open the book, and both edit the same page.
 */

// ─── Which page the book is showing, or null when it is shut ────────────────

let openKey: string | null = null;
const openWatchers = new Set<() => void>();

function notify(watchers: Set<() => void>) {
  for (const watcher of [...watchers]) watcher();
}

export function openDiary(dayKey: string) {
  if (openKey === dayKey) return;
  openKey = dayKey;
  notify(openWatchers);
}

export function closeDiary() {
  if (openKey === null) return;
  openKey = null;
  notify(openWatchers);
}

function subscribeOpen(watcher: () => void) {
  openWatchers.add(watcher);
  return () => {
    openWatchers.delete(watcher);
  };
}

const readOpen = () => openKey;
const readOpenOnServer = () => null;

export function useDiaryOpen() {
  return useSyncExternalStore(subscribeOpen, readOpen, readOpenOnServer);
}

// ─── "This page changed" ────────────────────────────────────────────────────
//
// The book and the pinned note can be showing the same day at the same time, so
// whichever one saves says so and the other reloads. Announcements carry their
// author so nobody reacts to their own write.

type ChangeWatcher = (dayKey: string, from: string) => void;

const changeWatchers = new Set<ChangeWatcher>();

export function announceDiaryChange(dayKey: string, from: string) {
  for (const watcher of [...changeWatchers]) watcher(dayKey, from);
}

export function subscribeDiaryChange(watcher: ChangeWatcher) {
  changeWatchers.add(watcher);
  return () => {
    changeWatchers.delete(watcher);
  };
}
