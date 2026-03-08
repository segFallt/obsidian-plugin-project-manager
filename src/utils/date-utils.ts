/**
 * Date utility functions used across the plugin.
 * All functions work with ISO date strings (YYYY-MM-DD) or ISO datetimes.
 * All date/time values use the user's local timezone, not UTC.
 */
import { ISO_DATE_LENGTH } from "../constants";

function padTwo(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Returns today's date as an ISO string (YYYY-MM-DD) in local time. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`;
}

/** Returns the current date-time as a local ISO string (YYYY-MM-DDTHH:mm:ss). */
export function nowDatetime(): string {
  const d = new Date();
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}T${padTwo(d.getHours())}:${padTwo(d.getMinutes())}:${padTwo(d.getSeconds())}`;
}

/** Returns the current date-time as a local ISO string (YYYY-MM-DDTHH:mm:ss). */
export function nowISO(): string {
  return nowDatetime();
}

/**
 * Checks if an ISO date string represents today.
 */
export function isToday(isoDate: string): boolean {
  return isoDate.substring(0, ISO_DATE_LENGTH) === todayISO();
}

/**
 * Checks if an ISO date string falls within the next 7 days (inclusive of today).
 */
export function isThisWeek(isoDate: string): boolean {
  const date = new Date(isoDate);
  const today = new Date(todayISO());
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return date >= today && date <= weekEnd;
}

/**
 * Checks if an ISO date string is in the past (strictly before today).
 */
export function isPast(isoDate: string): boolean {
  return isoDate.substring(0, ISO_DATE_LENGTH) < todayISO();
}

/**
 * Checks if an ISO date string is tomorrow.
 */
export function isTomorrow(isoDate: string): boolean {
  const [y, m, d] = todayISO().split("-").map(Number);
  const tomorrow = new Date(y, m - 1, d + 1);
  const tomorrowISO = `${tomorrow.getFullYear()}-${padTwo(tomorrow.getMonth() + 1)}-${padTwo(tomorrow.getDate())}`;
  return isoDate.substring(0, ISO_DATE_LENGTH) === tomorrowISO;
}

/**
 * Formats an ISO date string for display (YYYY-MM-DD → locale-appropriate short date).
 * Falls back to the raw string if parsing fails.
 */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  try {
    return new Date(isoDate).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}
