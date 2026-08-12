"use client";

import { useState, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { markRead, markAllRead } from "@/server/actions/notifications";
import { relativeTime } from "@/lib/relative-time";
import type { NotificationRow } from "@/server/services/notifications";

const DOT: Record<string, string> = {
  TASK_OVERDUE: "var(--status-red)",
  TASK_DUE_SOON: "var(--status-amber)",
  MEMBER_APPROVED: "var(--status-green)",
  DIGEST: "var(--primary)",
  AI_SUGGESTION: "var(--primary)",
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
  const router = useRouter();

  // No mounted guard needed: the portal only renders once `open` is true, and
  // that can only come from a click, which only ever happens on the client.

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const panel = (
    <>
      <div
        className="fixed inset-0 z-[9998]"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div className="overlay fixed right-3 top-12 z-[9999] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-[11px] uppercase tracking-[0.05em] text-faint">
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
              className="flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-foreground"
            >
              <CheckCheck size={11} />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[calc(0.6*var(--vh))] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-faint">
              Nothing yet
            </p>
          ) : (
            notifications.map((n) => {
              const unread = !n.readAt;
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
                  className="flex w-full gap-2.5 border-b border-border px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-[var(--card-hover)]"
                >
                  <span
                    className="dot mt-1.5"
                    style={{
                      background: unread
                        ? DOT[n.type] ?? "var(--text-faint)"
                        : "transparent",
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-[13px] ${
                        unread ? "" : "text-muted-foreground"
                      }`}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground">
                        {n.body}
                      </p>
                    )}
                    <p className="mt-1 text-[11px] text-faint">
                      {relativeTime(n.createdAt)}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <Link
          href="/notifications"
          onClick={() => setOpen(false)}
          className="block border-t border-border px-3 py-2 text-center text-[12px] text-faint transition-colors hover:text-foreground"
        >
          See all
        </Link>
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) router.refresh();
        }}
        className="icon-btn relative"
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
        )}
      </button>

      {open && createPortal(panel, document.body)}
    </>
  );
}