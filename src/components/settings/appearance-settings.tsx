"use client";

import { useEffect, useState, useTransition } from "react";
import { Type } from "lucide-react";
import { updateUiScale } from "@/server/actions/appearance";
import { UI_SCALES, UI_SCALE_LABELS, type UiScale } from "@/lib/ui-scale";
import { SettingsPanel } from "./settings-panel";

/**
 * Interface scale. The pills write the attribute the root layout renders, so
 * the whole app resizes on click — the page itself is the preview, which is
 * why there is no separate sample block here.
 */
export function AppearanceSettings({ value }: { value: UiScale }) {
  const [scale, setScale] = useState<UiScale>(value);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The root attribute is an external system, kept in step with local state.
  // Driving it from here rather than the click handler means a rollback needs
  // no second write — reverting `scale` puts the page back on its own.
  //
  // It runs on mount too, writing the value the server already rendered, which
  // is a no-op. Waiting for the round trip instead would leave the click
  // unacknowledged for as long as the write takes.
  useEffect(() => {
    document.documentElement.dataset.uiScale = scale;
  }, [scale]);

  function pick(next: UiScale) {
    if (next === scale) return;

    const previous = scale;
    setScale(next);
    setNote(null);

    startTransition(async () => {
      const result = await updateUiScale(next);
      if (!result.ok) {
        setScale(previous);
        setNote(result.error);
      }
    });
  }

  return (
    <SettingsPanel
      title="Appearance"
      icon={<Type size={12} />}
      dimmed={pending}
      description="Scales the whole interface, not just the text — spacing, pills and card heights move with it."
    >
      <div className="flex flex-col gap-2">
        <span className="text-[11px] uppercase tracking-[0.12em] text-faint">
          Interface size
        </span>

        <div className="flex flex-wrap gap-1.5">
          {UI_SCALES.map((option) => (
            <button
              key={option}
              type="button"
              data-on={scale === option}
              onClick={() => pick(option)}
              className="pill"
            >
              {UI_SCALE_LABELS[option]}
              {option === "medium" && (
                <span className="text-[11px] text-faint">Default</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {note && <p className="mt-4 text-[12px] text-destructive">{note}</p>}
    </SettingsPanel>
  );
}
