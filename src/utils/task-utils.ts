import type { DataviewTask, TaskContext, TaskPriority } from "../types";
import { PRIORITY_EMOJI } from "../constants";

/**
 * Determines the context category of a task based on its file path.
 */
export function getTaskContext(task: DataviewTask): TaskContext {
  const path = task.path;
  if (path.startsWith("projects/")) return "Project";
  if (path.startsWith("people/")) return "Person";
  if (path.startsWith("meetings/")) return "Meeting";
  if (path.startsWith("inbox/")) return "Inbox";
  if (path.startsWith("daily notes/")) return "Daily Notes";
  return "Other";
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
  return 3;
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
 */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
