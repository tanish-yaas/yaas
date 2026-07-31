import { signOut } from "@/auth";
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
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border/60 px-4 backdrop-blur-xl md:px-6">
      <CommandPalette />

      <div className="ml-auto flex items-center gap-3">
        <NotificationBell
          unreadCount={unreadCount}
          notifications={notifications}
        />

        <div className="flex items-center gap-2.5">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="h-8 w-8 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-violet/20 text-xs font-medium text-brand-violet">
              {initial}
            </div>
          )}
          <div className="hidden leading-tight sm:block">
            <p className="text-xs">{displayName}</p>
            <p className="text-[10px] text-muted-foreground">{roleName}</p>
          </div>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}