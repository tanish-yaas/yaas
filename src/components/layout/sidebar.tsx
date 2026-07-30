import Link from "next/link";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Users,
  Settings,
  Sparkles,
} from "lucide-react";
import { NavLink } from "./nav-link";

export function Sidebar({
  orgName,
  canApprove,
  pendingCount,
}: {
  orgName: string;
  canApprove: boolean;
  pendingCount: number;
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border/60 bg-sidebar/60 px-3 py-5 backdrop-blur-xl md:flex">
      <Link href="/" className="mb-7 flex items-center gap-2 px-3">
        <span className="text-gradient font-display text-xl font-semibold tracking-tight">
          YAAS
        </span>
      </Link>

      <p className="mb-2 px-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
        Workspace
      </p>
      <p className="mb-6 truncate px-3 text-sm">{orgName}</p>

      <nav className="flex flex-col gap-1">
        <NavLink href="/" label="Dashboard">
          <LayoutDashboard size={16} />
        </NavLink>
        <NavLink href="/tasks" label="Tasks">
          <CheckSquare size={16} />
        </NavLink>
        <NavLink href="/calendar" label="Calendar">
          <Calendar size={16} />
        </NavLink>
        <NavLink href="/assistant" label="Assistant">
          <Sparkles size={16} />
        </NavLink>

        {canApprove && (
          <div className="relative">
            <NavLink href="/admin/members" label="Members">
              <Users size={16} />
            </NavLink>
            {pendingCount > 0 && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-brand-magenta px-2 py-0.5 text-[10px] font-medium text-white">
                {pendingCount}
              </span>
            )}
          </div>
        )}
      </nav>

      <div className="mt-auto">
        <NavLink href="/settings" label="Settings">
          <Settings size={16} />
        </NavLink>
      </div>
    </aside>
  );
}