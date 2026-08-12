"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { acceptSuggestion, dismissSuggestion } from "@/server/actions/suggestions";
import { accentForSuggestion, iconForSuggestion } from "./suggestion-style";
import { SuggestionSheet } from "./suggestion-sheet";

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
  const [open, setOpen] = useState(false);
  // Accepting or dismissing revalidates, but the rail is a server component and
  // the row lingers for a beat. Hiding it locally keeps the card from sitting
  // there looking un-actioned.
  const [resolved, setResolved] = useState(false);
  const accent = accentForSuggestion(type);

  if (resolved) return null;

  return (
    <>
      {/* The whole card opens the detail. The two inline buttons stay for the
          common case where the reason is all you need — they stop propagation
          so acting doesn't also open the sheet behind the refresh. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`cursor-pointer rounded-lg border border-border/60 px-3 py-3 transition-colors hover:border-[color-mix(in_oklab,white_18%,transparent)] hover:bg-[color-mix(in_oklab,white_3%,transparent)] ${
          pending ? "opacity-40" : ""
        }`}
      >
        <div className="flex gap-2.5">
          <span className="mt-0.5 shrink-0" style={{ color: accent }}>
            {iconForSuggestion(type)}
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
              onClick={(e) => {
                e.stopPropagation();
                startTransition(async () => {
                  const result = await acceptSuggestion(id);
                  if (result.ok) setResolved(true);
                });
              }}
              className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-[11px] transition-colors hover:bg-secondary/70"
            >
              <Check size={11} />
              Do it
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={(e) => {
              e.stopPropagation();
              startTransition(async () => {
                const result = await dismissSuggestion(id);
                if (result.ok) setResolved(true);
              });
            }}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={11} />
            No thanks
          </button>
          <span className="ml-auto text-[10px] text-faint">Details</span>
        </div>
      </div>

      <SuggestionSheet
        suggestionId={open ? id : null}
        onClose={() => setOpen(false)}
        onResolved={() => setResolved(true)}
      />
    </>
  );
}
