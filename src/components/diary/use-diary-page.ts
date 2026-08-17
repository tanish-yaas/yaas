"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { APP_CONFIG } from "@/config/app";
import { diaryColorFor } from "@/lib/diary-color";
import {
  loadDiaryPage,
  pushDiaryPoint,
  saveDiaryPage,
} from "@/server/actions/diary";
import type { DiaryPoint } from "@/lib/validators/diary";
import type { DiaryTaskMeta } from "@/server/services/diary";
import { announceDiaryChange, subscribeDiaryChange } from "./diary-store";

const SAVE_DEBOUNCE_MS = 900;
const { maxPoints, maxPointChars } = APP_CONFIG.diary;

export type SaveState = "clean" | "dirty" | "saving" | "saved" | "failed";

export function blankPoint(): DiaryPoint {
  return { id: crypto.randomUUID(), text: "", taskId: null, taskTitle: null };
}

/** A page always offers a line to write on, even when it is empty. */
function withRoom(points: DiaryPoint[]): DiaryPoint[] {
  return points.length > 0 ? points : [blankPoint()];
}

/**
 * Everything a diary page does, minus how it looks.
 *
 * The book and the pinned note are the same page in two shapes, and both need
 * the same debounced saving, the same keyboard rules and the same push. This
 * holds all of it so neither one owns the behaviour.
 */
export function useDiaryPage(dayKey: string) {
  const { push: toast } = useToast();
  const instanceId = useId();

  const [points, setPoints] = useState<DiaryPoint[]>(() => [blankPoint()]);
  const [tasks, setTasks] = useState<DiaryTaskMeta[]>([]);
  const [color, setColorState] = useState(() => diaryColorFor(dayKey));
  /** Which day the points on screen belong to — anything else is still loading. */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("clean");
  const [pushingId, setPushingId] = useState<string | null>(null);

  // The debounced save fires after the state it is saving may have moved on, so
  // it reads the page from refs rather than the closure it was created in.
  const pointsRef = useRef(points);
  const colorRef = useRef(color);
  const dayKeyRef = useRef(dayKey);
  const timer = useRef<number | null>(null);
  const inputs = useRef(new Map<string, HTMLTextAreaElement>());

  const taskById = useMemo(() => {
    const map = new Map<string, DiaryTaskMeta>();
    for (const task of tasks) map.set(task.id, task);
    return map;
  }, [tasks]);

  const apply = useCallback((page: {
    dayKey: string;
    points: DiaryPoint[];
    color: string;
    tasks: DiaryTaskMeta[];
  }) => {
    const loaded = withRoom(page.points);
    pointsRef.current = loaded;
    colorRef.current = page.color;
    dayKeyRef.current = page.dayKey;
    setPoints(loaded);
    setTasks(page.tasks);
    setColorState(page.color);
    setSave("clean");
    setLoadedKey(page.dayKey);
  }, []);

  const reload = useCallback(async () => {
    const result = await loadDiaryPage(dayKeyRef.current);
    if (result.ok) apply(result.page);
  }, [apply]);

  const flush = useCallback(async () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }

    const key = dayKeyRef.current;

    setSave("saving");
    const result = await saveDiaryPage(key, pointsRef.current, colorRef.current);

    if (!result.ok) {
      setSave("failed");
      toast(result.error, "error");
      return false;
    }

    setSave("saved");
    announceDiaryChange(key, instanceId);
    return true;
  }, [instanceId, toast]);

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

  const setColor = useCallback(
    (next: string) => {
      colorRef.current = next;
      setColorState(next);
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
        toast(result.error, "error");
        setLoadedKey(dayKey);
        return;
      }

      apply(result.page);
    })();

    return () => {
      live = false;
    };
  }, [apply, dayKey, toast]);

  // Someone else saved this page. Take their version — unless there are edits
  // here that haven't landed yet, which would be thrown away by reloading.
  useEffect(
    () =>
      subscribeDiaryChange((changedKey, from) => {
        if (from === instanceId) return;
        if (changedKey !== dayKeyRef.current) return;
        if (timer.current !== null) return;
        void reload();
      }),
    [instanceId, reload]
  );

  // A page half-written when the tab goes away is still worth keeping.
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

  function registerInput(id: string, el: HTMLTextAreaElement | null) {
    if (el) inputs.current.set(id, el);
    else inputs.current.delete(id);
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
      toast(`A page holds ${maxPoints} points`, "error");
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
      toast(result.error, "error");
      return;
    }

    // Reloaded rather than patched in place: the task's real title and due date
    // are what should appear under the point, and only the server has them.
    await reload();
    announceDiaryChange(dayKeyRef.current, instanceId);
    toast(result.dueLabel ? `Added · due ${result.dueLabel}` : "Added to tasks");
  }

  /** True while a save is owed — the caller flushes before navigating away. */
  function isPending() {
    return timer.current !== null;
  }

  return {
    points,
    taskById,
    color,
    loading: loadedKey !== dayKey,
    save,
    pushingId,
    maxPointChars,
    setColor,
    editPoint,
    addPointAfter,
    removePoint,
    onPointKeyDown,
    pushPoint,
    registerInput,
    flush,
    isPending,
  };
}

export type DiaryPageApi = ReturnType<typeof useDiaryPage>;
