"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertOctagon,
  CalendarClock,
  Check,
  Scale,
  Split,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import {
  acceptSuggestion,
  dismissSuggestion,
} from "@/server/actions/suggestions";

export type SuggestionHintRow = {
  id: string;
  type: string;
  reason: string;
  actionable: boolean;
};

const ICONS: Record<string, React.ReactNode> = {
  TASK_PRIORITY: <TrendingUp size={13} />,
  DEADLINE_ADJUSTMENT: <CalendarClock size={13} />,
  WORKLOAD_REBALANCE: <Scale size={13} />,
  ROADBLOCK_RESOLUTION: <AlertOctagon size={13} />,
  TASK_BREAKDOWN: <Split size={13} />,
  SCHEDULE_SLOT: <CalendarClock size={13} />,
};

const ACCENTS: Record<string, string> = {
  TASK_PRIORITY: "var(--status-blue)",
  DEADLINE_ADJUSTMENT: "var(--status-red)",
  WORKLOAD_REBALANCE: "var(--status-amber)",
  ROADBLOCK_RESOLUTION: "var(--status-purple)",
  TASK_BREAKDOWN: "var(--primary)",
  SCHEDULE_SLOT: "var(--status-green)",
};

const accentOf = (type: string) => ACCENTS[type] ?? "var(--primary)";
const iconOf = (type: string) => ICONS[type] ?? <Sparkles size={13} />;

/**
 * The topbar's one piece of proactive surface. It shows the strongest pending
 * suggestion inline rather than hiding everything behind an icon, and stays out
 * of the bar entirely when there is nothing worth saying.
 */
export function SuggestionHint({
  suggestions,
}: {
  suggestions: SuggestionHintRow[];
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: -9999, top: -9999, width: 0 });
  const [pending, startTransition] = useTransition();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  // No mounted guard needed: the portal only renders once `open` is true, and
  // that can only come from a click, which only ever happens on the client.

  // Anchored to the trigger rather than the viewport — the sidebar shifts the
  // topbar's left edge, and the panel has to portal out to escape the shell.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.min(384, window.innerWidth - 24);

    setPosition({
      width,
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: rect.bottom + 8,
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Nothing pending means nothing to suggest — the bar keeps quiet.
  if (suggestions.length === 0) return null;

  const [top] = suggestions;
  const rest = suggestions.length - 1;

  function resolve(action: () => Promise<unknown>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  const panel = (
    <>
      <div
        className="fixed inset-0 z-[9998]"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        className="overlay fixed z-[9999] overflow-hidden"
        style={{
          left: position.left,
          top: position.top,
          width: position.width,
        }}
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-[11px] uppercase tracking-[0.05em] text-faint">
            Suggestions
          </span>
          <span className="text-[11px] tabular-nums text-faint">
            {suggestions.length}
          </span>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {suggestions.map((s) => (
            <div
              key={s.id}
              className={`border-b border-border px-3 py-3 last:border-0 ${
                pending ? "opacity-40" : ""
              }`}
            >
              <div className="flex gap-2.5">
                <span
                  className="mt-0.5 shrink-0"
                  style={{ color: accentOf(s.type) }}
                >
                  {iconOf(s.type)}
                </span>
                <p className="flex-1 text-[12px] leading-relaxed text-muted-foreground">
                  {s.reason}
                </p>
              </div>

              <div className="mt-2.5 flex items-center gap-2 pl-6">
                {s.actionable && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => resolve(() => acceptSuggestion(s.id))}
                    className="pill pill-sm"
                  >
                    <Check size={11} />
                    Do it
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => resolve(() => dismissSuggestion(s.id))}
                  className="inline-flex items-center gap-1 text-[11px] text-faint transition-colors hover:text-foreground"
                >
                  <X size={11} />
                  No thanks
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={top.reason}
        className="pill min-w-0 max-w-[22rem]"
      >
        <span className="shrink-0" style={{ color: accentOf(top.type) }}>
          {iconOf(top.type)}
        </span>
        <span className="hidden min-w-0 truncate sm:block">{top.reason}</span>
        {rest > 0 && (
          <span className="shrink-0 tabular-nums text-faint">+{rest}</span>
        )}
      </button>

      {open && createPortal(panel, document.body)}
    </>
  );
}
