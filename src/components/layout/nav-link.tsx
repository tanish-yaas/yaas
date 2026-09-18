"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  label,
  exact,
  collapsed,
  badge,
  children,
}: {
  href: string;
  label: string;
  /**
   * Match the path exactly. The workspace root (/w/acme) is a prefix of every
   * other route in the workspace, so a prefix match would leave Dashboard lit
   * while you are on Tasks.
   */
  exact?: boolean;
  collapsed?: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      prefetch
      title={collapsed ? label : undefined}
      className={`group relative flex h-7 items-center gap-2 rounded px-2 text-[13px] transition-colors ${
        active
          ? "bg-[var(--card-hover)] text-foreground"
          : "text-muted-foreground hover:bg-[var(--card-hover)] hover:text-foreground"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
      )}
      <span
        className={`flex w-4 shrink-0 items-center justify-center transition-colors ${
          active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
        }`}
      >
        {children}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
      {!collapsed && badge !== undefined && badge > 0 && (
        <span className="ml-auto text-[11px] tabular-nums text-faint">
          {badge}
        </span>
      )}
    </Link>
  );
}