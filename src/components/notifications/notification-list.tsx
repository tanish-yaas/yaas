"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, X, Bell } from "lucide-react";
import {
  markRead,
  markAllRead,
  archiveNotification,
} from "@/server/actions/notifications";

type Row = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  taskId: string | null;
  when: string;
  unread: boolean;
};

export function NotificationList({
  notifications,
  hasUnread,
}: {
  notifications: Row[];
  hasUnread: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (notifications.length === 0) {
    return (
      <div className="glass flex flex-col items-center gap-2 rounded-xl py-14 text-center">
        <Bell size={20} className="text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Nothing here yet</p>
        <p className="max-w-xs text-xs text-muted-foreground/70">
          Digests, assignments and approvals will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {hasUnread && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await markAllRead();
              router.refresh();
            })
          }
          className="self-end text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
        >
          <CheckCheck size={11} className="mr-1 inline" />
          Mark all read
        </button>
      )}

      <div className="glass overflow-hidden rounded-xl">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`group flex gap-3 border-b border-border/40 px-4 py-3.5 transition-colors last:border-0 hover:bg-secondary/30 ${
              n.unread ? "bg-brand-violet/[0.04]" : ""
            }`}
          >
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                n.unread ? "bg-brand-violet" : "bg-transparent"
              }`}
            />

            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  if (n.unread) await markRead(n.id);
                  if (n.taskId) router.push("/tasks");
                  else router.refresh();
                })
              }
              className="min-w-0 flex-1 text-left"
            >
              <p
                className={`text-sm ${
                  n.unread ? "" : "text-muted-foreground"
                }`}
              >
                {n.title}
              </p>
              {n.body && (
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground/70">
                  {n.body}
                </p>
              )}
              <p className="mt-1.5 text-[10px] text-muted-foreground/50">
                {n.when}
              </p>
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await archiveNotification(n.id);
                  router.refresh();
                })
              }
              className="shrink-0 self-start rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}