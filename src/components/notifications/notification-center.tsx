"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { BellOff, CheckCheck, Eraser, Settings2 } from "lucide-react";
import { useWorkspaceLink } from "@/components/workspace/use-workspace";
import { groupByDay, type NotificationView } from "@/lib/notifications";
import { NotificationRow } from "./notification-row";
import { useNotifications } from "./use-notifications";

const TaskDetailSheet = dynamic(
  () => import("@/components/tasks/task-detail-sheet").then((m) => m.TaskDetailSheet),
  { ssr: false }
);

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "tasks", label: "Tasks" },
  { key: "digests", label: "Digests" },
] as const;

type Filter = (typeof FILTERS)[number]["key"];

function matches(n: NotificationView, filter: Filter) {
  if (filter === "unread") return !n.read;
  if (filter === "tasks") return n.type.startsWith("TASK_");
  if (filter === "digests") return n.type === "DIGEST";
  return true;
}

/** The notifications page: the bell's list with room to breathe, and filters. */
export function NotificationCenter({
  items: served,
  unread: servedUnread,
  todayKey,
  limit,
}: {
  items: NotificationView[];
  unread: number;
  todayKey: string;
  /** How many were asked for, to say when the list stops short. */
  limit: number;
}) {
  const link = useWorkspaceLink();
  const list = useNotifications({ items: served, unread: servedUnread });
  const [filter, setFilter] = useState<Filter>("all");

  // A refresh from the server (an action's revalidation) replaces the list.
  const [seen, setSeen] = useState(served);
  if (seen !== served) {
    setSeen(served);
    list.setItems(served);
    list.setUnread(servedUnread);
  }

  const items = list.items ?? [];
  const shown = items.filter((n) => matches(n, filter));
  const groups = groupByDay(shown, todayKey);
  const anyRead = items.some((n) => n.read);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-[13px] text-faint">
            {list.unread > 0
              ? `${list.unread} unread`
              : "You're all caught up"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={list.readAll}
            disabled={list.unread === 0}
            className="pill pill-sm disabled:pointer-events-none disabled:opacity-40"
          >
            <CheckCheck size={13} />
            Mark all read
          </button>
          <button
            type="button"
            onClick={list.clearRead}
            disabled={!anyRead}
            title="Take everything you have read off this list"
            className="pill pill-sm disabled:pointer-events-none disabled:opacity-40"
          >
            <Eraser size={13} />
            Clear read
          </button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-1.5" role="tablist">
        {FILTERS.map((f) => {
          const count = items.filter((n) => matches(n, f.key)).length;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              data-on={filter === f.key}
              onClick={() => setFilter(f.key)}
              className="pill pill-sm"
            >
              {f.label}
              {f.key !== "all" && count > 0 && (
                <span className="tabular-nums opacity-60">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="panel flex flex-col items-center px-6 py-14 text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_oklab,white_6%,transparent)] text-faint">
            <BellOff size={17} />
          </span>
          <p className="text-[14px]">
            {filter === "unread"
              ? "Nothing unread"
              : filter === "all"
                ? "You're all caught up"
                : `No ${filter} here`}
          </p>
          <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-faint">
            When someone assigns you a task or comments on one of yours, it shows up here,
            along with your morning and evening digests.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-1.5 px-1 text-[11px] uppercase tracking-[0.12em] text-faint">
                {g.label}
              </h2>
              <div className="panel p-1.5">
                {g.items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    roomy
                    expanded={list.expanded === n.id}
                    onOpen={(x) => list.open(x)}
                    onDismiss={list.dismiss}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 px-1 text-[12px] text-faint">
        <span>
          {served.length >= limit
            ? `Showing the latest ${limit}. Clear read ones to see older.`
            : "Notifications stay here until you clear them."}
        </span>
        <span className="flex items-center gap-4">
          <Link
            href={link("/settings#reminders")}
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Settings2 size={12} />
            Digest settings
          </Link>
          <Link href={link("/reports")} className="transition-colors hover:text-foreground">
            Team activity is in Reports
          </Link>
        </span>
      </footer>

      {list.taskId && <TaskDetailSheet taskId={list.taskId} onClose={list.closeTask} />}
    </div>
  );
}
