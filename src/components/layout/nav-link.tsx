"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

export function NavLink({
  href,
  label,
  collapsed = false,
  badge,
  children,
}: {
  href: string;
  label: string;
  collapsed?: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      prefetch
      title={collapsed ? label : undefined}
      aria-label={label}
      className={`group relative flex items-center rounded-md text-sm transition-colors ${
        collapsed ? "h-9 w-9 justify-center" : "gap-2.5 px-2.5 py-[7px]"
      } ${active ? "" : "hover:bg-white/[0.05]"}`}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
          className="absolute inset-0 rounded-md bg-white/[0.07]"
        />
      )}

      {active && !collapsed && (
        <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-brand-violet" />
      )}

      <span
        className={`relative z-10 shrink-0 transition-colors ${
          active
            ? "text-brand-violet"
            : "text-muted-foreground group-hover:text-foreground"
        }`}
      >
        {children}
      </span>

      {!collapsed && (
        <span
          className={`relative z-10 min-w-0 flex-1 truncate transition-colors ${
            active
              ? "font-medium text-foreground"
              : "text-muted-foreground group-hover:text-foreground"
          }`}
        >
          {label}
        </span>
      )}

      {badge !== undefined && badge > 0 && (
        <span
          className={`z-10 shrink-0 rounded-full bg-brand-magenta text-[10px] font-medium leading-none text-white ${
            collapsed
              ? "absolute right-0 top-0 flex h-4 w-4 items-center justify-center"
              : "relative px-1.5 py-[3px]"
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
