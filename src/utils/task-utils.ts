import type { DataviewTask, TaskContext, TaskPriority } from "../types";
import { PRIORITY_EMOJI, CONTEXT, DEFAULT_PRIORITY } from "../constants";
import type { FolderSettings } from "../settings";

/**
 * Determines the context category of a task based on its file path.
 * Uses configurable folder settings so custom vault layouts are supported.
 */
export function getTaskContext(task: DataviewTask, folders: FolderSettings): TaskContext {
  const path = task.path;
  if (path.startsWith(folders.projects + "/") || path.startsWith(folders.projectNotes + "/")) return CONTEXT.PROJECT;
  if (path.startsWith(folders.people + "/")) return CONTEXT.PERSON;
  if (path.startsWith(folders.meetingsSingle + "/") || path.startsWith(folders.meetingsRecurring + "/")) return CONTEXT.MEETING;
  if (path.startsWith(folders.inbox + "/")) return CONTEXT.INBOX;
  if (path.startsWith(folders.dailyNotes + "/")) return CONTEXT.DAILY_NOTES;
  return CONTEXT.OTHER;
}

/**
 * Extracts the numeric priority from a task's text by looking for emoji markers.
 * Defaults to Medium (3) if no priority emoji is found.
 */
export function getTaskPriority(task: DataviewTask): TaskPriority {
  const text = task.text ?? "";
  for (const [emoji, priority] of Object.entries(PRIORITY_EMOJI)) {
    if (text.includes(emoji)) return priority as TaskPriority;
  }
  return DEFAULT_PRIORITY;
}

/**
 * Strips emoji metadata from task text for clean display.
 * Removes priority, due-date, completion-date, and recurrence markers.
 */
export function cleanTaskText(text: string): string {
  return text
    .replace(/[⏫🔼🔽⏬]/gu, "")
    .replace(/📅\s*\d{4}-\d{2}-\d{2}/gu, "")
    .replace(/✅\s*\d{4}-\d{2}-\d{2}/gu, "")
    .replace(/🔁[^📅✅⏫🔼🔽⏬]*/gu, "")
    .trim();
}

/**
 * Extracts an ISO date (YYYY-MM-DD) that follows a given emoji in task text.
 * Returns null if the emoji is not found or no date follows it.
 */
export function extractEmojiDate(text: string, emoji: string): string | null {
  const idx = text.indexOf(emoji);
  if (idx === -1) return null;
  const rest = text.substring(idx + emoji.length).trim();
  const match = rest.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * Adds a number of days to an ISO date string and returns the result as ISO string.
 * Parses as local date components to avoid UTC midnight shift artifacts.
 */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
