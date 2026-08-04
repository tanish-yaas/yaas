"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Clock,
  Link2,
  MapPin,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { formatIST, toLocalInput } from "@/lib/dates";
import type { EventPatch } from "@/lib/validators/event";
import type { EventItem } from "./types";

const WIDTH = 340;
const MARGIN = 12;

const ghostField =
  "w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs outline-none transition-colors hover:border-border focus:border-brand-violet focus:bg-secondary/40 disabled:hover:border-transparent";

export function EventPopover({
  event,
  anchor,
  openTasks,
  onClose,
  onPatch,
  onDelete,
}: {
  event: EventItem;
  anchor: DOMRect;
  openTasks: { id: string; title: string }[];
  onClose: () => void;
  onPatch: (eventId: string, patch: EventPatch) => Promise<string | null>;
  onDelete: (eventId: string) => Promise<string | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ left: -9999, top: -9999 });
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(event.title);
  const [location, setLocation] = useState(event.location);
  const [description, setDescription] = useState(event.description);
  const [startAt, setStartAt] = useState(toLocalInput(event.startAt));
  const [endAt, setEndAt] = useState(toLocalInput(event.endAt));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setTitle(event.title);
    setLocation(event.location);
    setDescription(event.description);
    setStartAt(toLocalInput(event.startAt));
    setEndAt(toLocalInput(event.endAt));
    setError(null);
    setConfirming(false);
  }, [event]);

  useLayoutEffect(() => {
    if (!mounted) return;
    const height = ref.current?.offsetHeight ?? 240;

    let left = anchor.right + 8;
    if (left + WIDTH > window.innerWidth - MARGIN) {
      left = anchor.left - WIDTH - 8;
    }
    if (left < MARGIN) {
      left = Math.min(
        Math.max(MARGIN, anchor.left),
        window.innerWidth - WIDTH - MARGIN
      );
    }

    const top = Math.max(
      MARGIN,
      Math.min(anchor.top, window.innerHeight - height - MARGIN)
    );

    setPosition({ left, top });
  }, [anchor, mounted, description, error]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };

    window.addEventListener("keydown", onKey);
    // Deferred so the click that opened this popover doesn't close it.
    const id = window.setTimeout(
      () => window.addEventListener("pointerdown", onPointer),
      0
    );

    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [onClose]);

  if (!mounted) return null;

  async function patch(next: EventPatch, revert: () => void) {
    setSaving(true);
    setError(null);
    const message = await onPatch(event.id, next);
    setSaving(false);
    if (message) {
      setError(message);
      revert();
    }
  }

  const readOnly = !event.canEdit;

  const card = (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-[95] rounded-xl border border-border bg-popover p-3 shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
      style={{ left: position.left, top: position.top, width: WIDTH }}
    >
      <div className="mb-2 flex items-start gap-2">
        <span
          className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: event.color }}
        />
        <input
          value={title}
          disabled={readOnly || saving}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() === event.title) return;
            patch({ title }, () => setTitle(event.title));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className={`${ghostField} text-sm font-medium`}
        />
        <button
          type="button"
          onClick={onClose}
          className="mt-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Line icon={<Clock size={12} />}>
          {readOnly ? (
            <span className="px-1.5 text-xs text-muted-foreground">
              {formatIST(new Date(event.startAt), {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {" – "}
              {formatIST(new Date(event.endAt), {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          ) : (
            <div className="flex w-full items-center gap-1">
              <input
                type="datetime-local"
                value={startAt}
                disabled={saving}
                onChange={(e) => setStartAt(e.target.value)}
                onBlur={() => {
                  if (startAt === toLocalInput(event.startAt)) return;
                  patch({ startAt }, () =>
                    setStartAt(toLocalInput(event.startAt))
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className={ghostField}
              />
              <span className="text-xs text-muted-foreground">→</span>
              <input
                type="datetime-local"
                value={endAt}
                disabled={saving}
                onChange={(e) => setEndAt(e.target.value)}
                onBlur={() => {
                  if (endAt === toLocalInput(event.endAt)) return;
                  patch({ endAt }, () => setEndAt(toLocalInput(event.endAt)));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className={ghostField}
              />
            </div>
          )}
        </Line>

        <Line icon={<MapPin size={12} />}>
          <input
            value={location}
            disabled={readOnly || saving}
            placeholder={readOnly ? "—" : "Add a location"}
            onChange={(e) => setLocation(e.target.value)}
            onBlur={() => {
              if (location === event.location) return;
              patch({ location }, () => setLocation(event.location));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            className={ghostField}
          />
        </Line>

        <Line icon={<CalendarDays size={12} />}>
          <span className="px-1.5 text-xs text-muted-foreground">
            {event.calendarName}
            {!event.isOwnCalendar && ` · ${event.ownerName}`}
          </span>
        </Line>

        <Line icon={<Link2 size={12} />}>
          {readOnly ? (
            <span className="px-1.5 text-xs text-muted-foreground">
              {event.taskTitle ?? "No linked task"}
            </span>
          ) : (
            <select
              value={event.taskId ?? ""}
              disabled={saving}
              onChange={(e) => patch({ taskId: e.target.value || null }, () => {})}
              className={ghostField}
            >
              <option value="">No linked task</option>
              {event.taskId && event.taskTitle && !openTasks.some((t) => t.id === event.taskId) && (
                <option value={event.taskId}>{event.taskTitle}</option>
              )}
              {openTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}
        </Line>

        {event.attendees.length > 0 && (
          <Line icon={<Users size={12} />}>
            <span className="px-1.5 text-xs text-muted-foreground">
              {event.attendees.map((a) => a.name).join(", ")}
            </span>
          </Line>
        )}

        <textarea
          value={description}
          disabled={readOnly || saving}
          rows={2}
          placeholder={readOnly ? "" : "Add a description"}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description === event.description) return;
            patch({ description }, () => setDescription(event.description));
          }}
          className={`${ghostField} mt-1 resize-none`}
        />
      </div>

      {error && <p className="mt-2 px-1.5 text-xs text-destructive">{error}</p>}

      {event.canEdit && (
        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5">
          <span className="px-1 text-[10px] text-muted-foreground">
            {saving ? "Saving…" : "Changes save as you go"}
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              if (!confirming) {
                setConfirming(true);
                window.setTimeout(() => setConfirming(false), 3000);
                return;
              }
              const message = await onDelete(event.id);
              if (message) setError(message);
              else onClose();
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] transition-colors ${
              confirming
                ? "bg-destructive/15 text-destructive"
                : "text-muted-foreground hover:text-destructive"
            }`}
          >
            <Trash2 size={12} />
            {confirming ? "Delete for good?" : "Delete"}
          </button>
        </div>
      )}
    </motion.div>
  );

  return createPortal(card, document.body);
}

function Line({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
