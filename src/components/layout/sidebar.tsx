"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Calendar,
  CheckSquare,
  ChevronLeft,
  LayoutDashboard,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { NavLink } from "./nav-link";
import { BrandLockup, BrandMark } from "./brand";

const COLLAPSE_KEY = "yaas.sidebar.collapsed";

export function Sidebar({
  orgName,
  canApprove,
  pendingCount,
}: {
  orgName: string;
  canApprove: boolean;
  pendingCount: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  // Read the stored preference after mount so the server and client agree on
  // the first paint, then reveal the real width.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // Private mode or a blocked store just means we start expanded.
    }
    setReady(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // Non-fatal — the toggle still applies for this session.
      }
      return next;
    });
  }

  return (
    <aside
      className={`group/rail relative hidden shrink-0 flex-col border-r border-border/60 bg-sidebar/60 py-4 backdrop-blur-xl md:flex ${
        collapsed ? "w-[68px] items-center px-3" : "w-[248px] px-3"
      } ${ready ? "transition-[width] duration-200 ease-out" : ""}`}
    >
      <Link
        href="/"
        aria-label="YAAS Nova home"
        className={`mb-6 flex items-center rounded-lg transition-opacity hover:opacity-80 ${
          collapsed ? "justify-center" : "px-1"
        }`}
      >
        {collapsed ? <BrandMark /> : <BrandLockup subtitle={orgName} />}
      </Link>

      {!collapsed && (
        <p className="mb-1.5 px-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
          Workspace
        </p>
      )}

      <nav className={`flex flex-col gap-0.5 ${collapsed ? "items-center" : ""}`}>
        <NavLink href="/" label="Home" collapsed={collapsed}>
          <LayoutDashboard size={16} />
        </NavLink>
        <NavLink href="/tasks" label="Tasks" collapsed={collapsed}>
          <CheckSquare size={16} />
        </NavLink>
        <NavLink href="/calendar" label="Calendar" collapsed={collapsed}>
          <Calendar size={16} />
        </NavLink>
        <NavLink href="/assistant" label="Assistant" collapsed={collapsed}>
          <Sparkles size={16} />
        </NavLink>
        <NavLink href="/notifications" label="Updates" collapsed={collapsed}>
          <Bell size={16} />
        </NavLink>

        {canApprove && (
          <NavLink
            href="/admin/members"
            label="People"
            collapsed={collapsed}
            badge={pendingCount}
          >
            <Users size={16} />
          </NavLink>
        )}
      </nav>

      <div className={`mt-auto ${collapsed ? "flex flex-col items-center" : ""}`}>
        <NavLink href="/settings" label="Settings" collapsed={collapsed}>
          <Settings size={16} />
        </NavLink>
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-7 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.4)] transition-all hover:text-foreground focus-visible:opacity-100 group-hover/rail:opacity-100"
      >
        <ChevronLeft
          size={13}
          className={`transition-transform duration-200 ${
            collapsed ? "rotate-180" : ""
          }`}
        />
      </button>
    </aside>
  );
}
