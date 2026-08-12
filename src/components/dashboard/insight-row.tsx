import { accentForSuggestion, iconForSuggestion } from "./suggestion-style";

/**
 * Read-only sibling of SuggestionCard. Shares its icons and accents so the two
 * sit together, but carries no accept/dismiss and does not open: an insight is
 * derived on every render and has no row behind it to act on or expand.
 */
export function InsightRow({ type, text }: { type: string; text: string }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-border/60 px-3 py-2.5">
      <span
        className="mt-0.5 shrink-0"
        style={{ color: accentForSuggestion(type) }}
      >
        {iconForSuggestion(type)}
      </span>
      <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
        {text}
      </p>
    </div>
  );
}
