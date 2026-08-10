import Link from "next/link";
import { signOut } from "@/auth";
import { LogOut } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { CommandPalette } from "./command-palette";
import {
  SuggestionHint,
  type SuggestionHintRow,
} from "./suggestion-hint";
import { Avatar } from "@/components/ui/avatar";
import type { NotificationRow } from "@/server/services/notifications";

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