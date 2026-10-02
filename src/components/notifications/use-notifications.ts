"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceLink } from "@/components/workspace/use-workspace";
import {
  archiveNotification,
  archiveRead,
  markAllRead,
  markRead,
} from "@/server/actions/notifications";
import type { NotificationView } from "@/lib/notifications";

/**
 * What the bell and the page both do to a list of notifications.
 *
 * Every change lands on screen first and is saved behind it: reading one, or
 * clearing twenty, should not wait on a round trip to look done. The server
 * catches up through the actions' own revalidation.
 */
export function useNotifications(initial: {
  items: NotificationView[] | null;
  unread: number;
}) {
  const router = useRouter();
  const link = useWorkspaceLink();
  const [items, setItems] = useState(initial.items);
  const [unread, setUnread] = useState(initial.unread);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);

  const save = (promise: Promise<unknown>) => {
    promise.catch(() => router.refresh());
  };

  function readLocally(id: string) {
    setItems((list) => list?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? list);
    setUnread((u) => Math.max(0, u - 1));
  }

  /**
   * A digest opens in place. Anything about a task opens that task right
   * here, rather than dropping you on the task list to find it. A join
   * request goes to where requests are approved.
   */
  function open(n: NotificationView, onLeave?: () => void) {
    if (!n.read) {
      readLocally(n.id);
      save(markRead(n.id));
    }

    if (n.type === "DIGEST") {
      setExpanded((current) => (current === n.id ? null : n.id));
      return;
    }
    if (n.task && !n.task.deleted) {
      onLeave?.();
      setTaskId(n.task.id);
      return;
    }
    if (n.href) {
      onLeave?.();
      router.push(link(n.href));
    }
  }

  function dismiss(n: NotificationView) {
    setItems((list) => list?.filter((x) => x.id !== n.id) ?? list);
    if (!n.read) setUnread((u) => Math.max(0, u - 1));
    save(archiveNotification(n.id));
  }

  function readAll() {
    setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? list);
    setUnread(0);
    save(markAllRead());
  }

  function clearRead() {
    setItems((list) => list?.filter((n) => !n.read) ?? list);
    save(archiveRead());
  }

  return {
    items,
    setItems,
    unread,
    setUnread,
    expanded,
    taskId,
    closeTask: () => {
      setTaskId(null);
      // Whatever changed in the sheet changed on whatever page is behind it.
      router.refresh();
    },
    open,
    dismiss,
    readAll,
    clearRead,
  };
}
