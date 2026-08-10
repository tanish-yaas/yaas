"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search,
  CheckSquare,
  Calendar,
  User,
  LayoutDashboard,
  Sparkles,
  Bell,
  Settings,
  Users,
  Loader2,
} from "lucide-react";
import { runSearch } from "@/server/actions/search";
import { Avatar } from "@/components/ui/avatar";
import type { SearchResult } from "@/server/services/search";

const NAV = [
  { id: "n1", label: "Dashboard", href: "/", icon: <LayoutDashboard size={14} />, kw: "home overview" },
  { id: "n2", label: "Tasks", href: "/tasks", icon: <CheckSquare size={14} />, kw: "todo work" },
  { id: "n3", label: "Calendar", href: "/calendar", icon: <Calendar size={14} />, kw: "events schedule" },
  { id: "n4", label: "Assistant", href: "/assistant", icon: <Sparkles size={14} />, kw: "ai chat ask" },
  { id: "n5", label: "Notifications", href: "/notifications", icon: <Bell size={14} />, kw: "alerts activity" },
  { id: "n6", label: "Members", href: "/admin/members", icon: <Users size={14} />, kw: "team people" },
  { id: "n7", label: "Settings", href: "/settings", icon: <Settings size={14} />, kw: "profile reminders" },
];

const KIND_ICON: Record<string, React.ReactNode> = {
  task: <CheckSquare size={14} />,
  event: <Calendar size={14} />,
  person: <User size={14} />,
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const router = useRouter();

  // No mounted guard needed: the portal only renders once `open` is true, and
  // that can only come from a keypress or a click — never on the server.

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        setResults(await runSearch(q));
        setActive(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  const q = query.trim().toLowerCase();
  const navMatches = q
    ? NAV.filter((n) => n.label.toLowerCase().includes(q) || n.kw.includes(q))
    : NAV;

  const combined = [
    ...navMatches.map((n) => ({ href: n.href })),
    ...results.map((r) => ({ href: r.href })),
  ];

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const panel = (
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/50"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div className="overlay fixed left-1/2 top-[18vh] z-[9999] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
          <Search size={14} className="shrink-0 text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, combined.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const entry = combined[active];
                if (entry) go(entry.href);
              }
            }}
            placeholder="Search tasks, events, people…"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
          {loading && <Loader2 size={13} className="animate-spin text-faint" />}
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-1">
          {combined.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px] text-faint">
              {q.length < 2 ? "Type to search" : "No matches"}
            </p>
          )}

          {navMatches.map((n, i) => (
            <button
              key={n.id}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => go(n.href)}
              className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors ${
                active === i ? "bg-[var(--card-hover)]" : ""
              }`}
            >
              <span className="text-faint">{n.icon}</span>
              {n.label}
            </button>
          ))}

          {results.length > 0 && (
            <p className="px-3 pb-1 pt-3 text-[11px] uppercase tracking-[0.05em] text-faint">
              Results
            </p>
          )}

          {results.map((r, i) => {
            const index = navMatches.length + i;
            return (
              <button
                key={`${r.kind}-${r.id}`}
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => go(r.href)}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                  active === index ? "bg-[var(--card-hover)]" : ""
                }`}
              >
                {/* People show their actual face, which is the whole point of
                    being able to look someone up. */}
                {r.kind === "person" ? (
                  <Avatar
                    avatarUrl={r.avatarUrl}
                    image={r.image}
                    name={r.title}
                    size={18}
                  />
                ) : (
                  <span className="shrink-0 text-faint">{KIND_ICON[r.kind]}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{r.title}</span>
                  {r.subtitle && (
                    <span className="block truncate text-[11px] text-faint">
                      {r.subtitle}
                    </span>
                  )}
                </span>
                {r.meta && (
                  <span className="shrink-0 text-[11px] text-faint">
                    {r.meta}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="pill">
        <Search size={14} />
        <span className="hidden sm:inline">Search tasks, events, people</span>
        <kbd className="ml-1 hidden rounded border border-border-strong px-1.5 py-px text-[10px] md:inline">
          ⌘K
        </kbd>
      </button>

      {open && createPortal(panel, document.body)}
    </>
  );
}