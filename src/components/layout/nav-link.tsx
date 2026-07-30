"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

export function NavLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      prefetch
      className="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="absolute inset-0 rounded-lg bg-brand-violet/15"
        />
      )}
      <span
        className={`relative z-10 transition-colors ${
          active
            ? "text-brand-violet"
            : "text-muted-foreground group-hover:text-foreground"
        }`}
      >
        {children}
      </span>
      <span
        className={`relative z-10 transition-colors ${
          active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}