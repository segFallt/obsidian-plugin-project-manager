/**
 * Date utility functions used across the plugin.
 * All functions work with ISO date strings (YYYY-MM-DD) or ISO datetimes.
 */

/** Returns today's date as an ISO string (YYYY-MM-DD). */
export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

/** Returns the current date-time as an ISO string. */
export function nowISO(): string {
  return new Date().toISOString();
}

/** Returns a datetime formatted for meeting frontmatter (YYYY-MM-DDTHH:mm:ss). */
export function nowDatetime(): string {
  return new Date().toISOString().substring(0, 19);
}

/**
 * Checks if an ISO date string represents today.
 */
export function isToday(isoDate: string): boolean {
  return isoDate.substring(0, 10) === todayISO();
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
  return isoDate.substring(0, 10) < todayISO();
}

/**
 * Checks if an ISO date string is tomorrow.
 */
export function isTomorrow(isoDate: string): boolean {
  const tomorrow = new Date(todayISO());
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isoDate.substring(0, 10) === tomorrow.toISOString().split("T")[0];
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
