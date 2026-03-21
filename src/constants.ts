/**
 * Shared constants for the Project Manager plugin.
 * Mirrors the vault's constants.js for consistency.
 */
import type { DueDatePreset, DueDateFilter } from "./types";

export const CLIENT_STATUSES = ["Active", "Inactive"] as const;
export const ENGAGEMENT_STATUSES = ["Active", "Inactive"] as const;
export const PROJECT_STATUSES = ["New", "Active", "On Hold", "Complete"] as const;

/** Project statuses shown by default in task views (excludes Complete). */
export const DEFAULT_TASK_VIEW_STATUSES = ["New", "Active", "On Hold"] as const;

/** All task context types based on folder location. */
export const TASK_CONTEXTS = ["Project", "Person", "Meeting", "Recurring Meeting", "Inbox", "Daily Notes", "Other"] as const;

/** Named context values for type-safe comparisons. */
export const CONTEXT = {
  PROJECT: "Project",
  PERSON: "Person",
  MEETING: "Meeting",
  RECURRING_MEETING: "Recurring Meeting",
  INBOX: "Inbox",
  DAILY_NOTES: "Daily Notes",
  OTHER: "Other",
} as const;

/** Priority numbers (1 = highest, 4 = lowest). */
export const TASK_PRIORITIES = [1, 2, 3, 4] as const;

/** Human-readable priority labels. */
export const PRIORITY_LABELS: Record<number, string> = {
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};

/** Priority display strings for task dashboard headers. */
export const PRIORITY_DISPLAY: Record<number, string> = {
  1: "⏫ Urgent",
  2: "🔼 High",
  3: "➖ Medium",
  4: "🔽 Low",
};

/** Maps Tasks plugin emoji to numeric priority. Medium (3) has no emoji. */
export const PRIORITY_EMOJI: Record<string, number> = {
  "⏫": 1, // Highest
  "🔼": 2, // High
  "🔽": 4, // Low
};

/** Due date emoji used by Tasks plugin. */
export const DUE_DATE_EMOJI = "📅";
/** Completion date emoji. */
export const COMPLETION_DATE_EMOJI = "✅";
/** Recurrence emoji. */
export const RECURRENCE_EMOJI = "🔁";

/** All available due date preset options in display order. */
export const DUE_DATE_PRESETS: readonly DueDatePreset[] = ["Today", "Tomorrow", "This Week", "Next Week", "Overdue", "No Date"];

/** Default (empty) due date filter — no presets selected, no range set. */
export const DEFAULT_DUE_DATE_FILTER: DueDateFilter = Object.freeze({
  selectedPresets: [],
  rangeFrom: null,
  rangeTo: null,
});

/** Named status values for type-safe comparisons. */
export const STATUS = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  NEW: "New",
  ON_HOLD: "On Hold",
  COMPLETE: "Complete",
} as const;

/** Sort order for project statuses in tables (lower = appears first). */
export const PROJECT_STATUS_ORDER: Record<string, number> = {
  New: 1,
  Active: 2,
  "On Hold": 3,
  Complete: 4,
};

// ─── Numeric constants ────────────────────────────────────────────────────

/** Default numeric priority (Medium). */
export const DEFAULT_PRIORITY = 3;
/** Number of days in a week. */
export const WEEK_DAYS = 7;
/** Length of an ISO date string (YYYY-MM-DD). */
export const ISO_DATE_LENGTH = 10;
/** Length of an ISO datetime string (YYYY-MM-DDTHH:mm:ss). */
export const ISO_DATETIME_LENGTH = 19;
/** Fallback sort priority for items with no priority set. */
export const PRIORITY_FALLBACK = 99;
/** Duration (ms) for Notice messages. */
export const NOTICE_DURATION_MS = 8000;
/** Max length for ARIA label substrings. */
export const ARIA_LABEL_MAX_LENGTH = 60;
/** Delay (ms) before focusing a modal input. */
export const FOCUS_DELAY_MS = 10;
/** Number of rows for textarea fields. */
export const TEXTAREA_ROWS = 3;

/** Debounce durations (ms) for different contexts. */
export const DEBOUNCE_MS = {
  PROPERTIES: 500,
  PROPERTIES_INITIAL: 150,
  TASKS: 1000,
  SEARCH: 200,
} as const;

/** Numeric weight for each log level (higher = more severe). */
export const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 } as const;

/** How often (ms) the logger flushes its in-memory buffer to disk. */
export const LOG_FLUSH_INTERVAL_MS = 5000;

/** Suffix appended to log file names (e.g. "2026-03-09-pm.log"). */
export const LOG_FILE_SUFFIX = "-pm.log";

/** Sentinel date strings for sort stability (tasks with no due date). */
export const SORT_SENTINEL = {
  MIN: "0000-00-00",
  MAX: "9999-99-99",
} as const;

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
  meetingsRecurringEvents: "meetings/recurring-events",
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

// ─── Frontmatter keys ─────────────────────────────────────────────────────

/** All frontmatter property key strings used across the plugin. */
export const FM_KEY = {
  CLIENT: "client",
  ENGAGEMENT: "engagement",
  STATUS: "status",
  ATTENDEES: "attendees",
  DATE: "date",
  NOTES: "notes",
  NOTES_DIRECTORY: "notesDirectory",
  DEFAULT_ATTENDEES: "default-attendees",
  RECURRING_MEETING: "recurring-meeting",
  LAST_EVENT_DATE: "last-event-date",
  CONVERTED_FROM: "convertedFrom",
  CONVERTED_TO: "convertedTo",
  RELATED_PROJECT: "relatedProject",
  START_DATE: "start-date",
  END_DATE: "end-date",
  CONTACT_NAME: "contact-name",
  CONTACT_EMAIL: "contact-email",
  CONTACT_PHONE: "contact-phone",
  TITLE: "title",
  REPORTS_TO: "reports-to",
  PRIORITY: "priority",
  DESCRIPTION: "description",
} as const;

// ─── CSS classes ──────────────────────────────────────────────────────────

/** CSS class name strings used in DOM construction. */
export const CSS_CLS = {
  PM_ERROR: "pm-error",
  INTERNAL_LINK: "internal-link",
} as const;

// ─── Codeblock identifiers ────────────────────────────────────────────────

/** Markdown code block language identifiers registered by the plugin. */
export const CODEBLOCK = {
  PM_ACTIONS: "pm-actions",
  PM_TASKS: "pm-tasks",
  PM_PROPERTIES: "pm-properties",
  PM_TABLE: "pm-table",
  PM_ENTITY_VIEW: "pm-entity-view",
  PM_RECURRING_EVENTS: "pm-recurring-events",
} as const;

// ─── User-facing messages ─────────────────────────────────────────────────

/** Repeated user-facing Notice and error message strings. */
export const MSG = {
  NO_NAME: "No name provided.",
  DATAVIEW_UNAVAILABLE: "Dataview is not available. Install and enable the Dataview plugin.",
} as const;

// ─── CSS variables ────────────────────────────────────────────────────────

/** Obsidian CSS custom property references used in inline styles. */
export const CSS_VAR = {
  TEXT_ERROR: "var(--text-error)",
  TEXT_MUTED: "var(--text-muted)",
} as const;

// ─── Notes section markers ────────────────────────────────────────────────

/** String markers used to locate and replace the Notes section in file content. */
export const NOTES_MARKER = {
  WITH_DASH: "# Notes\n-",
  BASE: "# Notes\n",
  PREFIX: "\n# Notes",
} as const;

// ─── String constants ─────────────────────────────────────────────────────

/** Markdown file extension. */
export const MD_EXTENSION = ".md";

/** Inbox note status options (separate from entity statuses). */
export const INBOX_STATUSES = ["Active", "Complete"] as const;

/** Length of a datetime-local input string (YYYY-MM-DDTHH:mm). */
export const ISO_DATETIME_INPUT_LENGTH = 16;

// ─── Plugin identifiers ────────────────────────────────────────────────────

export const DATAVIEW_PLUGIN_ID = "dataview";
export const PLUGIN_ID = "project-manager";
