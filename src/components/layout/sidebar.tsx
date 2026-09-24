"use client";

import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  ClipboardList,
  Users,
  Sparkles,
  Bell,
  PanelLeftClose,
} from "lucide-react";
import { NavLink } from "./nav-link";
import { wsPath } from "@/server/workspace/paths";
import { DiaryPin } from "@/components/diary/diary-pin";
import {
  WorkspaceSwitcher,
  type WorkspaceMenuData,
} from "@/components/workspace/workspace-switcher";

export function Sidebar({
  workspaceSlug,
  workspaceMenu,
  canApprove,
  pendingCount,
  todayKey,
  canPush,
  onToggle,
}: {
  /** Prefix for every link below. The workspace is in the URL, not in state. */
  workspaceSlug: string;
  /** The lockup at the top is the workspace switcher. */
  workspaceMenu: WorkspaceMenuData;
  canApprove: boolean;
  pendingCount: number;
  /** Today in IST — the page pinned at the bottom. */
  todayKey: string;
  /** Whether this member may run the parser behind the pin's push buttons.
      Also what puts Deliverables in the nav — it is one model call. */
  canPush: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className="focus-dim group/sidebar hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-[color-mix(in_oklab,var(--sidebar)_84%,transparent)] px-2.5 py-3 backdrop-blur-xl md:flex">
      <div className="mb-5 flex items-center gap-1">
        <WorkspaceSwitcher {...workspaceMenu} className="flex-1" />
        <button
          type="button"
          onClick={onToggle}
          title="Collapse sidebar"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint opacity-0 transition-all hover:bg-[var(--card-hover)] hover:text-foreground group-hover/sidebar:opacity-100"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      <nav className="flex flex-col gap-px">
        <NavLink href={wsPath(workspaceSlug, "/")} label="Dashboard" exact>
          <LayoutDashboard size={15} />
        </NavLink>
        <NavLink href={wsPath(workspaceSlug, "/tasks")} label="Tasks">
          <CheckSquare size={15} />
        </NavLink>
        <NavLink href={wsPath(workspaceSlug, "/calendar")} label="Calendar">
          <Calendar size={15} />
        </NavLink>
        <NavLink href={wsPath(workspaceSlug, "/assistant")} label="Assistant">
          <Sparkles size={15} />
        </NavLink>
        {canPush && (
          <NavLink href={wsPath(workspaceSlug, "/deliverables")} label="Deliverables">
            <ClipboardList size={15} />
          </NavLink>
        )}
        <NavLink href={wsPath(workspaceSlug, "/notifications")} label="Notifications">
          <Bell size={15} />
        </NavLink>
      </nav>

      {canApprove && (
        <>
          <p className="mb-1 mt-6 px-2 text-[10px] uppercase tracking-[0.14em] text-faint">
            Admin
          </p>
          <nav className="flex flex-col gap-px">
            <NavLink
              href={wsPath(workspaceSlug, "/admin/members")}
              label="Members"
              badge={pendingCount}
            >
              <Users size={15} />
            </NavLink>
          </nav>
        </>
      )}

      {/* Settings used to sit here. It lives next to the profile in the topbar
          now, where it is also reachable with the sidebar collapsed. */}

      {/* Directly under the nav, not pushed to the floor: the note grows down
          as points are added, and the sidebar scrolls once it runs out of
          room. */}
      <DiaryPin todayKey={todayKey} canPush={canPush} />
    </aside>
  );
}