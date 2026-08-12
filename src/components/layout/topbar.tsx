import Link from "next/link";
import { signOut } from "@/auth";
import { LogOut, Settings } from "lucide-react";
import { APP_CONFIG } from "@/config/app";
import { NotificationBell } from "./notification-bell";
import { CommandPalette } from "./command-palette";
import {
  SuggestionHint,
  type SuggestionHintRow,
} from "./suggestion-hint";
import { Avatar } from "@/components/ui/avatar";
import type { NotificationRow } from "@/server/services/notifications";

/** Server-rendered, like every other date in the app — the browser is not on
    IST and would greet by its own clock. */
function greeting(tz: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: tz,
    }).format(new Date())
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Topbar({
  displayName,
  roleName,
  image,
  avatarUrl,
  userId,
  unreadCount,
  notifications,
  suggestions,
}: {
  displayName: string;
  roleName: string;
  image?: string | null;
  avatarUrl?: string | null;
  userId: string;
  unreadCount: number;
  notifications: NotificationRow[];
  suggestions: SuggestionHintRow[];
}) {
  return (
    <>
      <CommandPalette />

      {/* Moved off the dashboard, where it cost a whole heading block plus its
          own line for the date. Here it fills bar space that was empty anyway.
          Hidden below lg so it never squeezes the search field. */}
      <div className="hidden min-w-0 shrink items-baseline gap-2 lg:flex">
        <span className="truncate text-[13px]">
          {greeting(APP_CONFIG.timezone)}, {displayName.split(" ")[0]}
        </span>
        <span className="shrink-0 whitespace-nowrap text-[12px] text-faint">
          {new Intl.DateTimeFormat("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: APP_CONFIG.timezone,
          }).format(new Date())}
        </span>
      </div>

      <SuggestionHint suggestions={suggestions} />

      <div className="ml-auto flex items-center gap-2">
        <NotificationBell
          unreadCount={unreadCount}
          notifications={notifications}
        />

        <Link
          href={`/people/${userId}`}
          className="pill"
          title={`${displayName} · ${roleName}`}
        >
          <Avatar
            avatarUrl={avatarUrl}
            image={image}
            name={displayName}
            size={20}
          />
          <span className="hidden sm:block">{displayName}</span>
        </Link>

        {/* Sat at the bottom of the sidebar before. Next to the profile it is
            with the rest of the "about you" controls, and it stays reachable
            when the sidebar is collapsed. */}
        <Link href="/settings" title="Settings" className="icon-btn">
          <Settings size={14} />
        </Link>

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