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
      <div className="panel flex flex-col items-center gap-2 px-6 py-14 text-center">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl border border-[color-mix(in_oklab,white_9%,transparent)] bg-[color-mix(in_oklab,white_4%,transparent)]">
          <Bell size={17} className="text-faint" />
        </div>
        <p className="text-[13px] text-muted-foreground">Nothing here yet</p>
        <p className="max-w-xs text-[12px] leading-relaxed text-faint">
          Digests, assignments and approvals will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
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
          className="pill h-7 self-end text-[12px] disabled:opacity-50"
        >
          <CheckCheck size={12} />
          Mark all read
        </button>
      )}

      <div className="list">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`group flex gap-3 px-4 py-3.5 transition-colors hover:bg-[color-mix(in_oklab,white_4%,transparent)] ${
              n.unread ? "bg-brand-violet/[0.05]" : ""
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
                className={`text-[13px] ${
                  n.unread ? "" : "text-muted-foreground"
                }`}
              >
                {n.title}
              </p>
              {n.body && (
                <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground">
                  {n.body}
                </p>
              )}
              <p className="mt-1.5 text-[10px] text-faint">{n.when}</p>
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
              className="hover-action shrink-0 self-start rounded p-1"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}