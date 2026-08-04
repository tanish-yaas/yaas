"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Check, Eye, EyeOff, Share2, UserPlus, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  revokeCalendarShare,
  shareCalendar,
} from "@/server/actions/calendar-shares";
import type { CalendarOption } from "./types";

const WIDTH = 300;

const ACCESS_LABEL: Record<string, string> = {
  VIEW: "Can view",
  COMMENT: "Can comment",
  EDIT: "Can edit",
  FULL_ACCESS: "Full access",
};

const field =
  "w-full rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs outline-none transition-colors focus:border-brand-violet";

export function CalendarPanel({
  anchor,
  calendars,
  hidden,
  members,
  canShare,
  onToggle,
  onClose,
}: {
  anchor: DOMRect;
  calendars: CalendarOption[];
  hidden: Set<string>;
  members: { userId: string; name: string }[];
  canShare: boolean;
  onToggle: (calendarId: string) => void;
  onClose: () => void;
}) {
  const { push } = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ left: -9999, top: -9999 });
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [level, setLevel] = useState("VIEW");
  const [pending, startTransition] = useTransition();

  useEffect(() => setMounted(true), []);

  useLayoutEffect(() => {
    if (!mounted) return;
    const height = ref.current?.offsetHeight ?? 320;

    setPosition({
      left: Math.max(
        12,
        Math.min(anchor.right - WIDTH, window.innerWidth - WIDTH - 12)
      ),
      top: Math.min(anchor.bottom + 8, window.innerHeight - height - 12),
    });
  }, [anchor, mounted, sharingId, calendars]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const id = window.setTimeout(
      () => window.addEventListener("pointerdown", onPointer),
      0
    );
    window.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  function share(calendarId: string) {
    if (!target) return;
    startTransition(async () => {
      const result = await shareCalendar(calendarId, target, level);
      if (!result.ok) {
        push(result.error, "error");
        return;
      }
      setTarget("");
      push("Calendar shared");
    });
  }

  function revoke(shareId: string) {
    startTransition(async () => {
      const result = await revokeCalendarShare(shareId);
      if (!result.ok) {
        push(result.error, "error");
        return;
      }
      push("Access revoked");
    });
  }

  const panel = (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed z-[94] max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-popover p-3 shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
      style={{ left: position.left, top: position.top, width: WIDTH }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Calendars
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X size={13} />
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        {calendars.map((calendar) => {
          const visible = !hidden.has(calendar.id);

          return (
            <div key={calendar.id}>
              <div className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-secondary/50">
                <button
                  type="button"
                  onClick={() => onToggle(calendar.id)}
                  title={visible ? "Hide from views" : "Show in views"}
                  className="flex shrink-0 items-center"
                >
                  <span
                    className="flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors"
                    style={{
                      backgroundColor: visible ? calendar.color : "transparent",
                      borderColor: calendar.color,
                    }}
                  >
                    {visible && <Check size={9} className="text-white" />}
                  </span>
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{calendar.name}</p>
                  {!calendar.isOwn && (
                    <p className="truncate text-[10px] text-muted-foreground">
                      {calendar.ownerName}
                    </p>
                  )}
                </div>

                <span className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </span>

                {canShare && calendar.canShare && (
                  <button
                    type="button"
                    onClick={() =>
                      setSharingId((id) => (id === calendar.id ? null : calendar.id))
                    }
                    title="Share this calendar"
                    className={`shrink-0 rounded p-1 transition-colors ${
                      sharingId === calendar.id
                        ? "text-brand-violet"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Share2 size={12} />
                  </button>
                )}
              </div>

              {sharingId === calendar.id && (
                <div className="mb-1 ml-6 rounded-lg border border-brand-violet/30 bg-brand-violet/5 px-2 py-2">
                  {calendar.shares.length > 0 && (
                    <div className="mb-2 flex flex-col gap-1">
                      {calendar.shares.map((row) => (
                        <div
                          key={row.id}
                          className="flex items-center gap-2 text-[11px]"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {row.name}
                          </span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {ACCESS_LABEL[row.accessLevel] ?? row.accessLevel}
                          </span>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => revoke(row.id)}
                            className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                            aria-label={`Revoke ${row.name}`}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <select
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      className={field}
                    >
                      <option value="">Share with…</option>
                      {members
                        .filter(
                          (m) =>
                            !calendar.shares.some((s) => s.userId === m.userId)
                        )
                        .map((m) => (
                          <option key={m.userId} value={m.userId}>
                            {m.name}
                          </option>
                        ))}
                    </select>

                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className={field}
                    >
                      {Object.entries(ACCESS_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={pending || !target}
                      onClick={() => share(calendar.id)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-medium text-primary-foreground disabled:opacity-40"
                    >
                      <UserPlus size={11} />
                      Grant access
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {calendars.some((c) => !c.isOwn) && (
        <p className="mt-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground/70">
          Events are coloured by whose calendar they live on.
        </p>
      )}
    </motion.div>
  );

  return createPortal(panel, document.body);
}
