/**
 * Shared constants for the Project Manager plugin.
 * Mirrors the vault's constants.js for consistency.
 */

export const CLIENT_STATUSES = ["Active", "Inactive"] as const;
export const ENGAGEMENT_STATUSES = ["Active", "Inactive"] as const;
export const PROJECT_STATUSES = ["New", "Active", "On Hold", "Complete"] as const;

/** Project statuses shown by default in task views (excludes Complete). */
export const DEFAULT_TASK_VIEW_STATUSES = ["New", "Active", "On Hold"] as const;

/** All task context types based on folder location. */
export const TASK_CONTEXTS = ["Project", "Person", "Meeting", "Inbox", "Daily Notes"] as const;

/** Priority numbers (1 = highest, 5 = lowest). */
export const TASK_PRIORITIES = [1, 2, 3, 4, 5] as const;

/** Human-readable priority labels. */
export const PRIORITY_LABELS: Record<number, string> = {
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
  5: "Someday",
};

/** Priority display strings for task dashboard headers. */
export const PRIORITY_DISPLAY: Record<number, string> = {
  1: "⏫ Urgent",
  2: "🔼 High",
  3: "➖ Medium",
  4: "🔽 Low",
  5: "⏬ Someday",
};

/** Maps Tasks plugin emoji to numeric priority. Medium (3) has no emoji. */
export const PRIORITY_EMOJI: Record<string, number> = {
  "⏫": 1, // Highest
  "🔼": 2, // High
  "🔽": 4, // Low
  "⏬": 5, // Lowest
};

/** Due date emoji used by Tasks plugin. */
export const DUE_DATE_EMOJI = "📅";
/** Completion date emoji. */
export const COMPLETION_DATE_EMOJI = "✅";
/** Recurrence emoji. */
export const RECURRENCE_EMOJI = "🔁";

// ─── Folder paths (defaults, overrideable via settings) ───────────────────

export const DEFAULT_FOLDERS = {
  clients: "clients",
  engagements: "engagements",
  projects: "projects",
  projectNotes: "projects/notes",
  people: "people",
  inbox: "inbox",
  meetingsSingle: "meetings/single",
  meetingsRecurring: "meetings/recurring",
  dailyNotes: "daily notes",
  utility: "utility",
} as const;

// ─── Tags ──────────────────────────────────────────────────────────────────

export const ENTITY_TAGS = {
  client: "#client",
  engagement: "#engagement",
  project: "#project",
  person: "#person",
} as const;

// ─── Plugin identifiers ────────────────────────────────────────────────────

export const DATAVIEW_PLUGIN_ID = "dataview";
export const PLUGIN_ID = "project-manager";
