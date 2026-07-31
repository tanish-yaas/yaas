import { APP_CONFIG } from "@/config/app";

/** IST is UTC+5:30 all year — no daylight saving to account for. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/**
 * Turn a datetime-local value ("2026-07-31T13:00") into a real Date.
 * The browser hands us wall-clock text with no timezone, so we read it as IST.
 */
export function fromLocalInput(value: string | null | undefined): Date | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;

  const wallClockAsUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5])
  );

  const date = new Date(wallClockAsUtc - IST_OFFSET_MS);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format a Date as the "YYYY-MM-DDTHH:mm" a datetime-local input expects, in IST. */
export function toLocalInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_CONFIG.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Human-readable date and time in IST. */
export function formatIST(
  date: Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }
): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-GB", {
    ...options,
    timeZone: APP_CONFIG.timezone,
  }).format(date);
}