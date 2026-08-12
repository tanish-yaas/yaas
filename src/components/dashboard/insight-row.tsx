"use client";

import { useState } from "react";
import { accentForSuggestion, iconForSuggestion } from "./suggestion-style";
import { InsightSheet } from "./insight-sheet";
import type { InsightFilter } from "@/server/services/insights";

/**
 * Read-only sibling of SuggestionCard. Shares its icons and accents so the two
 * sit together, and carries no accept/dismiss — an insight is derived on every
 * render and has no row behind it to act on.
 *
 * It does open, though. The text is a count, and a count you cannot open is a
 * dead end. This is what the panel shows most of the time: the AISuggestion
 * table only fills from the nightly run and empties as soon as its rows are
 * actioned, so the fallback is the common case, not the rare one.
 */
export function InsightRow({
  type,
  text,
  filter,
}: {
  type: string;
  text: string;
  /** Null for the all-clear line, which describes an absence. Stays inert. */
  filter: InsightFilter;
}) {
  const [open, setOpen] = useState(false);
  const accent = accentForSuggestion(type);

  const body = (
    <>
      <span className="mt-0.5 shrink-0" style={{ color: accent }}>
        {iconForSuggestion(type)}
      </span>
      <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
        {text}
      </p>
    </>
  );

  if (!filter) {
    return (
      <div className="flex gap-2.5 rounded-lg border border-border/60 px-3 py-2.5">
        {body}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full gap-2.5 rounded-lg border border-border/60 px-3 py-2.5 text-left transition-colors hover:border-[color-mix(in_oklab,white_18%,transparent)] hover:bg-[color-mix(in_oklab,white_3%,transparent)]"
      >
        {body}
      </button>

      <InsightSheet
        filter={open ? filter : null}
        reason={text}
        type={type}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
