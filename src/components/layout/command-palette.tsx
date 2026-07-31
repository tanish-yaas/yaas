"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  CornerDownLeft,
  Loader2,
} from "lucide-react";
import { runSearch } from "@/server/actions/search";
import type { SearchResult } from "@/server/services/search";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  keywords: string;
};

const NAV: NavItem[] = [
  {
    id: "nav-dashboard",
    label: "Dashboard",
    href: "/",
    icon: <LayoutDashboard size={14} />,
    keywords: "home overview today",
  },
  {
    id: "nav-tasks",
    label: "Tasks",
    href: "/tasks",
    icon: <CheckSquare size={14} />,
    keywords: "todo work items",
  },
  {
    id: "nav-calendar",
    label: "Calendar",
    href: "/calendar",
    icon: <Calendar size={14} />,
    keywords: "events schedule month",
  },
  {
    id: "nav-assistant",
    label: "Assistant",
    href: "/assistant",
    icon: <Sparkles size={14} />,
    keywords: "ai chat ask",
  },
  {
    id: "nav-notifications",
    label: "Notifications",
    href: "/notifications",
    icon: <Bell size={14} />,
    keywords: "alerts digest activity",
  },
  {
    id: "nav-members",
    label: "Members",
    href: "/admin/members",
    icon: <Users size={14} />,
    keywords: "team people approve",
  },
  {
    id: "nav-settings",
    label: "Settings",
    href: "/settings",
    icon: <Settings size={14} />,
    keywords: "profile whatsapp reminders hours",
  },
];

const KIND_ICON: Record<string, React.ReactNode> = {
  task: <CheckSquare size={14} />,
  event: <Calendar size={14} />,
  person: <User size={14} />,
};

const KIND_COLOR: Record<string, string> = {
  task: "#7C5CFF",
  event: "#22D3EE",
  person: "#F5B544",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  // Global shortcut
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

  // Reset on close, focus on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      setQuery("");
      setResults([]);
      setActive(0);
    }
  }, [open]);

  // Debounced search
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
        const found = await runSearch(q);
        setResults(found);
        setActive(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [query]);

  const navMatches = query.trim()
    ? NAV.filter(
        (n) =>
          n.label.toLowerCase().includes(query.trim().toLowerCase()) ||
          n.keywords.includes(query.trim().toLowerCase())
      )
    : NAV;

  const combined = [
    ...navMatches.map((n) => ({ type: "nav" as const, item: n })),
    ...results.map((r) => ({ type: "result" as const, item: r })),
  ];

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, combined.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = combined[active];
      if (entry) go(entry.item.href);
    }
  }

  const panel = (
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div className="fixed left-1/2 top-[15vh] z-[9999] w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border border-[#26262f] bg-[#16161d] shadow-[0_30px_90px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-3 border-b border-[#26262f] px-4 py-3.5">
          <Search size={16} className="shrink-0 text-[#8b8b9e]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search tasks, events, people…"
            className="flex-1 bg-transparent text-sm text-[#f2f2f7] outline-none placeholder:text-[#8b8b9e]"
          />
          {loading && (
            <Loader2 size={14} className="animate-spin text-[#7c5cff]" />
          )}
          <kbd className="rounded border border-[#26262f] px-1.5 py-0.5 text-[10px] text-[#8b8b9e]">
            ESC
          </kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto py-1.5">
          {combined.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-[#8b8b9e]">
                {query.trim().length < 2
                  ? "Type to search"
                  : `Nothing matching "${query.trim()}"`}
              </p>
            </div>
          )}

          {navMatches.length > 0 && (
            <>
              <p className="px-4 py-1.5 text-[10px] uppercase tracking-[0.15em] text-[#8b8b9e]/60">
                Go to
              </p>
              {navMatches.map((n, i) => (
                <button
                  key={n.id}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(n.href)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    active === i ? "bg-[#7c5cff]/15" : "hover:bg-[#1c1c24]"
                  }`}
                >
                  <span className="shrink-0 text-[#8b8b9e]">{n.icon}</span>
                  <span className="flex-1 text-sm text-[#f2f2f7]">
                    {n.label}
                  </span>
                  {active === i && (
                    <CornerDownLeft size={12} className="text-[#8b8b9e]" />
                  )}
                </button>
              ))}
            </>
          )}

          {results.length > 0 && (
            <>
              <p className="px-4 py-1.5 pt-3 text-[10px] uppercase tracking-[0.15em] text-[#8b8b9e]/60">
                Results
              </p>
              {results.map((r, i) => {
                const index = navMatches.length + i;
                return (
                  <button
                    key={`${r.kind}-${r.id}`}
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(r.href)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      active === index
                        ? "bg-[#7c5cff]/15"
                        : "hover:bg-[#1c1c24]"
                    }`}
                  >
                    <span
                      className="shrink-0"
                      style={{ color: KIND_COLOR[r.kind] }}
                    >
                      {KIND_ICON[r.kind]}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[#f2f2f7]">
                        {r.title}
                      </span>
                      {r.subtitle && (
                        <span className="block truncate text-[11px] text-[#8b8b9e]">
                          {r.subtitle}
                        </span>
                      )}
                    </span>

                    {r.meta && (
                      <span className="shrink-0 text-[10px] text-[#8b8b9e]/70">
                        {r.meta}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-[#26262f] px-4 py-2 text-[10px] text-[#8b8b9e]/60">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[#26262f] px-1">↑</kbd>
            <kbd className="rounded border border-[#26262f] px-1">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[#26262f] px-1">↵</kbd>
            open
          </span>
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 text-left text-xs text-muted-foreground transition-colors hover:border-brand-violet/40 md:max-w-sm"
      >
        <Search size={14} />
        Search tasks, events, people
        <kbd className="ml-auto hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] md:inline">
          ⌘K
        </kbd>
      </button>

      {mounted && open && createPortal(panel, document.body)}
    </>
  );
}