import { signOut } from "@/auth";
import { LogOut } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { CommandPalette } from "./command-palette";
import type { NotificationRow } from "@/server/services/notifications";

export function Topbar({
  displayName,
  roleName,
  image,
  unreadCount,
  notifications,
}: {
  displayName: string;
  roleName: string;
  image?: string | null;
  unreadCount: number;
  notifications: NotificationRow[];
}) {
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <CommandPalette />

      <div className="ml-auto flex items-center gap-2">
        <NotificationBell
          unreadCount={unreadCount}
          notifications={notifications}
        />

        <div className="pill" title={`${displayName} · ${roleName}`}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-5 w-5 rounded-full" />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--card-hover)] text-[10px]">
              {initial}
            </span>
          )}
          <span className="hidden sm:block">{displayName}</span>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" title="Sign out" className="icon-btn">
            <LogOut size={14} />
          </button>
        </form>
      </div>
    </>
  );
}