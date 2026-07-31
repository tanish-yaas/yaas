"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  Sparkles,
  CalendarClock,
  UserCheck,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { markRead, markAllRead } from "@/server/actions/notifications";
import { relativeTime } from "@/lib/relative-time";
import type { NotificationRow } from "@/server/services/notifications";

const ICONS: Record<string, React.ReactNode> = {
  TASK_ASSIGNED: <UserCheck size={13} />,
  TASK_DUE_SOON: <CalendarClock size={13} />,
  TASK_OVERDUE: <AlertTriangle size={13} />,
  TASK_COMMENT: <MessageSquare size={13} />,
  MEMBER_APPROVED: <UserCheck size={13} />,
  MEMBER_JOIN_REQUEST: <UserCheck size={13} />,
  AI_SUGGESTION: <Sparkles size={13} />,
  DIGEST: <Sparkles size={13} />,
};

const ACCENTS: Record<string, string> = {
  TASK_OVERDUE: "#FF4D6D",
  TASK_DUE_SOON: "#F5B544",
  DIGEST: "#7C5CFF",
  AI_SUGGESTION: "#7C5CFF",
  MEMBER_APPROVED: "#4ADE80",
};

export function NotificationBell({
  unreadCount,
  notifications,
}: {
  unreadCount: number;
  notifications: NotificationRow[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    function onClick(e: MouseEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) router.refresh();
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-magenta px-1 text-[9px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
            <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await markAllRead();
                    router.refresh();
                  })
                }
                className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <CheckCheck size={11} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
                <Bell size={18} className="text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">Nothing yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const unread = !n.readAt;
                const accent = ACCENTS[n.type] ?? "#8B8B9E";

                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        if (unread) await markRead(n.id);
                        if (n.taskId) {
                          setOpen(false);
                          router.push("/tasks");
                        } else {
                          router.refresh();
                        }
                      })
                    }
                    className={`flex w-full gap-2.5 border-b border-border/40 px-4 py-3 text-left transition-colors last:border-0 hover:bg-secondary/40 ${
                      unread ? "bg-brand-violet/[0.04]" : ""
                    }`}
                  >
                    <span className="mt-0.5 shrink-0" style={{ color: accent }}>
                      {ICONS[n.type] ?? <Bell size={13} />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-xs ${
                          unread ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground/70">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground/50">
                        {relativeTime(n.createdAt)}
                      </p>
                    </div>

                    {unread && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-violet" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 border-t border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Check size={11} />
            See all
          </Link>
        </div>
      )}
    </div>
  );
}