"use client";

import { useTransition } from "react";
import { Check, X, TrendingUp, CalendarClock, Scale, AlertOctagon, Split } from "lucide-react";
import { acceptSuggestion, dismissSuggestion } from "@/server/actions/suggestions";

const ICONS: Record<string, React.ReactNode> = {
  TASK_PRIORITY: <TrendingUp size={13} />,
  DEADLINE_ADJUSTMENT: <CalendarClock size={13} />,
  WORKLOAD_REBALANCE: <Scale size={13} />,
  ROADBLOCK_RESOLUTION: <AlertOctagon size={13} />,
  TASK_BREAKDOWN: <Split size={13} />,
};

const ACCENTS: Record<string, string> = {
  TASK_PRIORITY: "#22D3EE",
  DEADLINE_ADJUSTMENT: "#FF4D6D",
  WORKLOAD_REBALANCE: "#F5B544",
  ROADBLOCK_RESOLUTION: "#FF4D8F",
  TASK_BREAKDOWN: "#7C5CFF",
};

export function SuggestionCard({
  id,
  type,
  reason,
  actionable,
}: {
  id: string;
  type: string;
  reason: string;
  actionable: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const accent = ACCENTS[type] ?? "#7C5CFF";

  return (
    <div
      className={`rounded-lg border border-border/60 px-3 py-3 transition-opacity ${
        pending ? "opacity-40" : ""
      }`}
    >
      <div className="flex gap-2.5">
        <span className="mt-0.5 shrink-0" style={{ color: accent }}>
          {ICONS[type] ?? <TrendingUp size={13} />}
        </span>
        <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
          {reason}
        </p>
      </div>

      <div className="mt-2.5 flex items-center gap-2 pl-6">
        {actionable && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await acceptSuggestion(id);
              })
            }
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-[11px] transition-colors hover:bg-secondary/70"
          >
            <Check size={11} />
            Do it
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await dismissSuggestion(id);
            })
          }
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={11} />
          No thanks
        </button>
      </div>
    </div>
  );
}