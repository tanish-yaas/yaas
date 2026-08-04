import { APP_CONFIG } from "@/config/app";

/** IST is UTC+5:30 all year — no daylight saving to account for. */
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

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

// ---------------------------------------------------------------------------
// Calendar grid maths
//
// Every view is laid out against IST wall-clock days. Because IST has no DST,
// a day is exactly 24h and the whole thing is arithmetic — no Intl round trips
// per cell, and identical results on the server and in the browser whatever
// timezone the visitor's machine happens to be in.
// ---------------------------------------------------------------------------

export type ISTFields = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday, matching Date#getDay. */
  weekday: number;
};

/** Wall-clock fields of a moment, read in IST. */
export function istFields(date: Date): ISTFields {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** "YYYY-MM-DD" — the IST calendar day a moment falls on. */
export function istDayKey(date: Date): string {
  const f = istFields(date);
  return `${f.year}-${pad(f.month)}-${pad(f.day)}`;
}

export function istTodayKey(): string {
  return istDayKey(new Date());
}

export function isDayKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** The real instant of a wall-clock time on an IST calendar day. */
export function istKeyToDate(key: string, hour = 0, minute = 0): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute) - IST_OFFSET_MS);
}

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate()
  )}`;
}

export function addMonthsToKey(key: string, months: number): string {
  const [y, m] = key.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-01`;
}

/** Whole days between two day keys (b - a). */
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round(
    (istKeyToDate(b).getTime() - istKeyToDate(a).getTime()) / 86_400_000
  );
}

/** The Monday on or before a day. */
export function istWeekStartKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDaysToKey(key, -((weekday + 6) % 7));
}

export function istMonthStartKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

/** Minutes since IST midnight. */
export function istMinutesIntoDay(date: Date): number {
  const f = istFields(date);
  return f.hour * 60 + f.minute;
}

/**
 * "YYYY-MM-DDTHH:mm" for a datetime-local input, from an IST day plus an
 * offset in minutes. Minutes outside 0–1439 roll into neighbouring days, so
 * an event ending at 24:00 lands on midnight the next morning.
 */
export function localInputFromKey(key: string, minutes: number): string {
  const dayShift = Math.floor(minutes / 1440);
  const rest = minutes - dayShift * 1440;
  const day = dayShift === 0 ? key : addDaysToKey(key, dayShift);
  return `${day}T${pad(Math.floor(rest / 60))}:${pad(rest % 60)}`;
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