"use client";

import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Users,
  Settings,
  Sparkles,
  Bell,
  PanelLeftClose,
} from "lucide-react";
import { NavLink } from "./nav-link";
import { BrandLockup } from "./brand";

export function Sidebar({
  canApprove,
  pendingCount,
  onToggle,
}: {
  canApprove: boolean;
  pendingCount: number;
  onToggle: () => void;
}) {
  return (
    <aside className="group/sidebar hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-[color-mix(in_oklab,var(--sidebar)_84%,transparent)] px-2.5 py-3 backdrop-blur-xl md:flex">
      <div className="mb-6 flex items-start gap-1 px-1">
        <BrandLockup size={38} className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={onToggle}
          title="Collapse sidebar"
          className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint opacity-0 transition-all hover:bg-[var(--card-hover)] hover:text-foreground group-hover/sidebar:opacity-100"
        >
          <PanelLeftClose size={14} />
        </button>
      </div>

      <nav className="flex flex-col gap-px">
        <NavLink href="/" label="Dashboard">
          <LayoutDashboard size={15} />
        </NavLink>
        <NavLink href="/tasks" label="Tasks">
          <CheckSquare size={15} />
        </NavLink>
        <NavLink href="/calendar" label="Calendar">
          <Calendar size={15} />
        </NavLink>
        <NavLink href="/assistant" label="Assistant">
          <Sparkles size={15} />
        </NavLink>
        <NavLink href="/notifications" label="Notifications">
          <Bell size={15} />
        </NavLink>
      </nav>

      {canApprove && (
        <>
          <p className="mb-1 mt-6 px-2 text-[10px] uppercase tracking-[0.14em] text-faint">
            Admin
          </p>
          <nav className="flex flex-col gap-px">
            <NavLink href="/admin/members" label="Members" badge={pendingCount}>
              <Users size={15} />
            </NavLink>
          </nav>
        </>
      )}

      <div className="mt-auto pt-4">
        <NavLink href="/settings" label="Settings">
          <Settings size={15} />
        </NavLink>
      </div>
    </aside>
  );
}