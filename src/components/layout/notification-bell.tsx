"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Bell, BellOff, CheckCheck, Settings2 } from "lucide-react";
import { useWorkspaceLink } from "@/components/workspace/use-workspace";
import { loadNotifications, unreadNotificationCount } from "@/server/actions/notifications";
import { anchorOf } from "@/lib/ui-scale";
import { istTodayKey } from "@/lib/dates";
import { groupByDay } from "@/lib/notifications";
import { NotificationRow } from "@/components/notifications/notification-row";
import { useNotifications } from "@/components/notifications/use-notifications";

const TaskDetailSheet = dynamic(
  () => import("@/components/tasks/task-detail-sheet").then((m) => m.TaskDetailSheet),
  { ssr: false }
);

/** How often the badge checks for new ones while the tab is in front. */
const POLL_MS = 60_000;
const WIDTH = 400;

/**
 * The bell and its panel.
 *
 * The list is read when the panel opens (and on hover, so it is usually
 * there already), not with every page: the topbar only needs the count. The
 * panel hangs off the bell itself, measured through ui-scale, and portals to
 * the body like every other overlay.
 */
export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const link = useWorkspaceLink();
  const list = useNotifications({ items: null, unread: unreadCount });
  const { items, setItems, unread, setUnread } = list;

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [place, setPlace] = useState({ left: -9999, top: -9999, width: WIDTH, maxHeight: 520 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const loading = useRef(false);

  // A navigation brings a fresh count from the server; take it.
  const [served, setServed] = useState(unreadCount);
  if (served !== unreadCount) {
    setServed(unreadCount);
    setUnread(unreadCount);
  }

  async function load() {
    if (loading.current) return;
    loading.current = true;
    try {
      const fresh = await loadNotifications();
      setItems(fresh.items);
      setUnread(fresh.unread);
    } catch {
      // The panel keeps whatever it had; the next open tries again.
    } finally {
      loading.current = false;
    }
  }

  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        setUnread(await unreadNotificationCount());
      } catch {
        // A missed tick is harmless; there is another in a minute.
      }
    };
    const id = window.setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [setUnread]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = anchorOf(buttonRef.current);
    const width = Math.min(WIDTH, rect.viewportWidth - 24);
    const top = rect.bottom + 8;
    setPlace({
      width,
      top,
      left: Math.max(12, Math.min(rect.right - width, rect.viewportWidth - width - 12)),
      maxHeight: Math.max(240, rect.viewportHeight - top - 16),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const shown = (items ?? []).filter((n) => tab === "all" || !n.read);
  const groups = groupByDay(shown, istTodayKey());
  const close = () => setOpen(false);

  const panel = (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={close} aria-hidden />
      <div
        role="dialog"
        aria-label="Notifications"
        className="overlay fixed z-[9999] flex flex-col overflow-hidden"
        style={{ left: place.left, top: place.top, width: place.width, maxHeight: place.maxHeight }}
      >
        <div className="flex items-center gap-2 border-b border-[color-mix(in_oklab,white_8%,transparent)] px-3.5 py-2.5">
          <h2 className="text-[13px] font-semibold">Notifications</h2>

          <div className="ml-auto flex items-center gap-1">
            {(["all", "unread"] as const).map((t) => (
              <button
                key={t}
                type="button"
                data-on={tab === t}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
                // Not .pill: it is unlayered CSS and keeps its own height.
                className="flex h-6 items-center gap-1 rounded-md px-2 text-[11px] text-faint transition-colors hover:text-foreground data-[on=true]:bg-[color-mix(in_oklab,var(--primary)_16%,transparent)] data-[on=true]:text-[color-mix(in_oklab,var(--primary)_70%,white)]"
              >
                {t === "all" ? "All" : "Unread"}
                {t === "unread" && unread > 0 && (
                  <span className="tabular-nums opacity-70">{unread}</span>
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={list.readAll}
              disabled={unread === 0}
              title="Mark all as read"
              aria-label="Mark all as read"
              className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-faint transition-colors hover:bg-[color-mix(in_oklab,white_8%,transparent)] hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
            >
              <CheckCheck size={14} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
          {items === null ? (
            <div className="flex flex-col gap-1 p-2" aria-busy>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex animate-pulse gap-3 px-1.5 py-2">
                  <div className="h-[30px] w-[30px] rounded-full bg-[color-mix(in_oklab,white_7%,transparent)]" />
                  <div className="flex-1">
                    <div className="h-3 w-4/5 rounded bg-[color-mix(in_oklab,white_7%,transparent)]" />
                    <div className="mt-2 h-2.5 w-1/4 rounded bg-[color-mix(in_oklab,white_5%,transparent)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_oklab,white_6%,transparent)] text-faint">
                <BellOff size={16} />
              </span>
              <p className="text-[13px]">
                {tab === "unread" ? "Nothing unread" : "You're all caught up"}
              </p>
              <p className="mt-1 max-w-[16rem] text-[12px] leading-relaxed text-faint">
                Assignments, comments on your tasks and your daily digests show up here.
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.label}>
                <h3 className="px-2 pb-1 pt-3 text-[10px] uppercase tracking-[0.12em] text-faint">
                  {g.label}
                </h3>
                {g.items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    expanded={list.expanded === n.id}
                    onOpen={(x) => list.open(x, close)}
                    onDismiss={list.dismiss}
                  />
                ))}
              </section>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[color-mix(in_oklab,white_8%,transparent)] px-3.5 py-2 text-[12px]">
          <Link
            href={link("/settings#reminders")}
            onClick={close}
            className="flex items-center gap-1.5 text-faint transition-colors hover:text-foreground"
          >
            <Settings2 size={12} />
            Digest settings
          </Link>
          <Link
            href={link("/notifications")}
            onClick={close}
            className="text-faint transition-colors hover:text-foreground"
          >
            See all
          </Link>
        </div>
      </div>
    </>
  );

  const badge = unread > 9 ? "9+" : String(unread);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onPointerEnter={() => {
          if (items === null) void load();
        }}
        onFocus={() => {
          if (items === null) void load();
        }}
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="icon-btn relative"
      >
        <Bell size={14} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-semibold tabular-nums leading-none text-white ring-2 ring-[var(--background)]">
            {badge}
          </span>
        )}
      </button>

      {open && createPortal(panel, document.body)}

      {list.taskId && <TaskDetailSheet taskId={list.taskId} onClose={list.closeTask} />}
    </>
  );
}
