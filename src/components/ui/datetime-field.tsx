"use client";

import { useState } from "react";

/**
 * A date and a time, in the one format this app uses: dd/mm/yyyy and a
 * 24-hour clock.
 *
 * Why not `<input type="datetime-local">`, which this replaces everywhere:
 * that control renders in the *browser's* locale, and en-IN pairs dd/mm/yyyy
 * with a 12-hour clock. So it grows an AM/PM segment that starts empty and
 * reads as "--". Type a date and a time, miss that segment, and the field is
 * silently invalid — the browser refuses the form with "the field is
 * incomplete", pointing at a field that looks filled in. No attribute turns
 * the segment off; the hour cycle is the browser's to choose.
 *
 * A native date picker has no such segment, so the date keeps one. The time is
 * a plain 24-hour box beside it, which cannot be half-filled.
 *
 * The value in and out is always the "YYYY-MM-DDTHH:mm" that
 * fromLocalInput / toLocalInput speak. Nothing downstream changes.
 */
export function DateTimeField({
  name,
  value,
  defaultValue,
  onChange,
  onCommit,
  disabled,
  required,
  /** Hour used when a date is given with no time. */
  defaultHour = 17,
  className = "",
}: {
  /** Set for an uncontrolled form field; a hidden input carries the value. */
  name?: string;
  /** Controlled "YYYY-MM-DDTHH:mm". */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Fired when a sub-field is left, for call sites that save on blur. */
  onCommit?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  defaultHour?: number;
  className?: string;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");

  // Read straight off the prop when controlled rather than mirroring it into
  // state — the detail sheet reverts the value when a save fails, and a mirror
  // needs an effect to follow it back.
  const current = value ?? uncontrolled;
  const [date = "", rawTime = ""] = current.split("T");
  const time = rawTime.slice(0, 5);

  // Held only while the time box has focus, so typing "1" on the way to "17:30"
  // is not rewritten to "01:00" under the cursor.
  const [draft, setDraft] = useState<string | null>(null);

  /** "" when there is no date: an empty field means "no deadline", not epoch. */
  const combine = (d: string, t: string) =>
    d ? `${d}T${t || `${pad(defaultHour)}:00`}` : "";

  function emit(next: string) {
    if (value === undefined) setUncontrolled(next);
    onChange?.(next);
    return next;
  }

  return (
    <div className={`flex gap-1.5 ${className}`}>
      {name && <input type="hidden" name={name} value={combine(date, time)} />}

      <input
        type="date"
        value={date}
        required={required}
        disabled={disabled}
        onChange={(e) => emit(combine(e.target.value, time))}
        onBlur={() => onCommit?.(combine(date, time))}
        className="field min-w-0 flex-1"
      />

      <input
        type="text"
        inputMode="numeric"
        placeholder="--:--"
        aria-label="Time, 24-hour"
        value={draft ?? time}
        disabled={disabled || !date}
        maxLength={5}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setDraft(time)}
        onBlur={(e) => {
          setDraft(null);
          onCommit?.(emit(combine(date, normaliseTime(e.target.value))));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        style={{ width: "5.5rem" }}
        className="field field-auto shrink-0 text-center tabular-nums"
      />
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * What someone types, as HH:mm. "5" is five o'clock, "1730" is half five,
 * "5:3" is 05:03. Anything that is not a time becomes "", which the field then
 * reads as "this day, at the default hour" rather than refusing to submit.
 */
export function normaliseTime(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // A colon says exactly where the split is, so "5:3" is 05:03 rather than the
  // 53 o'clock that reading the digits by length alone would make of it.
  const colon = /^(\d{1,2})\s*:\s*(\d{1,2})$/.exec(trimmed);
  if (colon) {
    const h = Number(colon[1]);
    const m = Number(colon[2]);
    return h > 23 || m > 59 ? "" : `${pad(h)}:${pad(m)}`;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 0) return "";

  let hours: number;
  let minutes: number;

  if (digits.length <= 2) {
    hours = Number(digits);
    minutes = 0;
  } else if (digits.length === 3) {
    hours = Number(digits.slice(0, 1));
    minutes = Number(digits.slice(1));
  } else {
    hours = Number(digits.slice(0, 2));
    minutes = Number(digits.slice(2, 4));
  }

  if (hours > 23 || minutes > 59) return "";
  return `${pad(hours)}:${pad(minutes)}`;
}
