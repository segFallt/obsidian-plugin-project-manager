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

/** Priority numbers (1 = highest, 5 = lowest / Someday). */
export const TASK_PRIORITIES = [1, 2, 3, 4] as const;

/** Human-readable priority labels. */
export const PRIORITY_LABELS: Record<number, string> = {
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
  5: "Someday",
};

/** String priority options for select fields, derived from PRIORITY_LABELS keys
 * (sorted numerically) so it stays in sync with the label map. */
export const PRIORITY_OPTIONS: string[] = Object.keys(PRIORITY_LABELS).sort((a, b) => Number(a) - Number(b));

/** Priority display strings for task dashboard headers. */
export const PRIORITY_DISPLAY: Record<number, string> = {
  1: "⏫ Urgent",
  2: "🔼 High",
  3: "➖ Medium",
  4: "🔽 Low",
  5: "⏬ Someday",
};

/** Section headings for the task dashboard's date view. */
export const DATE_BUCKET_LABEL = {
  OVERDUE: "⚠️ Overdue",
  TODAY: "📅 Today",
  TOMORROW: "📆 Tomorrow",
  THIS_WEEK: "📋 This Week",
  UPCOMING: "🔮 Upcoming",
  NO_DUE_DATE: "📝 No Due Date",
} as const;

/** Section heading for untagged tasks in the task dashboard's tag view. */
export const TAG_VIEW_LABEL = {
  UNTAGGED: "📌 Untagged",
} as const;

/**
 * Stable identifiers for the task filter facets. Each keys a `FilterSpec` facet
 * and the matching `FilterState.selections` entry — sharing one source keeps the
 * facet definition and the selection builder from drifting.
 */
export const FACET_KEY = {
  SHOW_COMPLETED: "showCompleted",
  CONTEXT: "context",
  SEARCH_TEXT: "searchText",
  DUE_DATE: "dueDate",
  PRIORITY: "priority",
  CLIENT: "client",
  ENGAGEMENT: "engagement",
  TAG: "tag",
  PROJECT_STATUS: "projectStatus",
  INBOX_STATUS: "inboxStatus",
  MEETING_DATE: "meetingDate",
} as const;

/**
 * Filter facet keys for the RAID dashboard. `MATRIX_CELL` is the facet the
 * interactive matrix renderer owns — the shell excludes it (`specWithout`) when
 * computing the matrix's per-cell counts so a selected cell keeps the others'.
 */
export const RAID_FACET_KEY = {
  RAID_TYPES: "raidTypes",
  STATUS: "statusFilter",
  CLIENT: "clientFilter",
  ENGAGEMENT: "engagementFilter",
  SEARCH_TEXT: "searchText",
  MATRIX_CELL: "matrixCell",
} as const;

/** The facet keys gated to the "context" view mode. */
export const CONTEXT_FACET_KEYS = [
  FACET_KEY.PROJECT_STATUS,
  FACET_KEY.INBOX_STATUS,
  FACET_KEY.MEETING_DATE,
] as const;

/** The `DashboardFilters` fields that hold the context-view-gated filters. */
export const CONTEXT_FILTER_FIELDS = [
  "projectStatusFilter",
  "inboxStatusFilter",
  "meetingDateFilter",
] as const;

/** Union of the context-view-gated `DashboardFilters` field names. */
export type ContextFilterField = (typeof CONTEXT_FILTER_FIELDS)[number];

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

/** Named due-date preset values (a `DueDatePreset` each). */
export const DUE_DATE_PRESET = {
  TODAY: "Today",
  TOMORROW: "Tomorrow",
  THIS_WEEK: "This Week",
  NEXT_WEEK: "Next Week",
  OVERDUE: "Overdue",
  NO_DATE: "No Date",
} as const;

/** Named meeting-date filter values (a `MeetingDateFilter` each; `ALL` = no filter). */
export const MEETING_DATE_FILTER = {
  ALL: "All",
  TODAY: "Today",
  THIS_WEEK: "This Week",
  PAST: "Past",
} as const;

/** Named inbox-status filter values (an `InboxStatusFilter` each; `ALL` = no filter). */
export const INBOX_STATUS_FILTER = {
  ALL: "All",
  ACTIVE: "Active",
  COMPLETE: "Complete",
} as const;

/** All available due date preset options in display order. */
export const DUE_DATE_PRESETS: readonly DueDatePreset[] = Object.values(DUE_DATE_PRESET);

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
/** Day offset for tomorrow (relative to today). */
export const TOMORROW_OFFSET = 1;
/** Day offset for the start of next week (relative to today). */
export const NEXT_WEEK_START_OFFSET = WEEK_DAYS + 1;
/** Day offset for the end of next week (relative to today). */
export const NEXT_WEEK_END_OFFSET = WEEK_DAYS * 2;
/** Length of an ISO date string (YYYY-MM-DD). */
export const ISO_DATE_LENGTH = 10;
/** Milliseconds in one day, for age/elapsed-day calculations. */
export const MS_PER_DAY = 86400000;
/** Length of an ISO datetime string (YYYY-MM-DDTHH:mm:ss). */
export const ISO_DATETIME_LENGTH = 19;
/** Fallback sort priority for items with no priority set. */
export const PRIORITY_FALLBACK = 99;
/** Duration (ms) for Notice messages. */
export const NOTICE_DURATION_MS = 8000;
/** Max length for ARIA label substrings. */
export const ARIA_LABEL_MAX_LENGTH = 60;
/** Delay (ms) before focusing a modal input or opening a subsequent modal.
 * Must be long enough to let any in-flight DOM keyboard events (keydown/keyup)
 * from the preceding modal clear the event queue before the next modal receives
 * focus.  10 ms is less than one animation frame (~16.67 ms) and is too short;
 * 150 ms gives the browser one or more full frames to flush pending events. */
export const FOCUS_DELAY_MS = 150;
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

/** `typeof` result strings, for type-guard comparisons without bare literals. */
export const JS_TYPE = {
  OBJECT: "object",
  STRING: "string",
} as const;

/** Dataview sort-order argument values. */
export const SORT_ORDER = {
  ASC: "asc",
  DESC: "desc",
} as const;

/** How often (ms) the logger flushes its in-memory buffer to disk. */
export const LOG_FLUSH_INTERVAL_MS = 5000;

/** Suffix appended to log file names (e.g. "2026-03-09-pm.log"). */
export const LOG_FILE_SUFFIX = "-pm.log";

/** Logger context tag strings for each processor / view / command. */
export const LOG_CONTEXT = {
  PROPERTIES_PROCESSOR: "pm-properties",
  TABLE_PROCESSOR: "pm-table",
  TASKS_PROCESSOR: "pm-tasks-processor",
  TASKS_DASHBOARD: "pm-tasks-dashboard",
  TASKS_BY_PROJECT: "pm-tasks-by-project",
  RAID_DASHBOARD_PROCESSOR: "pm-raid-dashboard-processor",
  RAID_DASHBOARD: "pm-raid-dashboard",
  ENTITY_VIEW: "pm-entity-view",
  CREATE_RAID_ITEM: "create-raid-item",
  CREATE_REFERENCE: "create-reference",
  CREATE_REFERENCE_TOPIC: "create-reference-topic",
  TAG_RAID_REFERENCE: "tag-raid-reference",
  REFERENCE_DASHBOARD_VIEW: "pm-reference-dashboard-view",
  RECURRING_EVENTS: "pm-recurring-events",
  CREATE_CLIENT: "create-client",
  CREATE_ENGAGEMENT: "create-engagement",
  CREATE_PROJECT: "create-project",
  CREATE_PERSON: "create-person",
  CREATE_INBOX: "create-inbox",
  CREATE_SINGLE_MEETING: "create-single-meeting",
  CREATE_RECURRING_MEETING: "create-recurring-meeting",
  CREATE_RECURRING_MEETING_EVENT: "create-recurring-meeting-event",
  CREATE_PROJECT_NOTE: "create-project-note",
  CONVERT_INBOX_TO_PROJECT: "convert-inbox-to-project",
  CONVERT_SINGLE_TO_RECURRING: "convert-single-to-recurring",
  UPDATE_REFERENCE_TOPIC: "update-reference-topic",
} as const;

/** Sentinel date strings for sort stability (tasks with no due date). */
export const SORT_SENTINEL = {
  MIN: "0000-00-00",
  MAX: "9999-99-99",
} as const;

/** Opacity applied to disabled action buttons. */
export const BUTTON_OPACITY_DISABLED = 0.5;
/** Maximum number of retries when the Dataview cache is unavailable. */
export const CACHE_RETRY_MAX = 3;
/** Padding applied to inline error containers. */
export const ERROR_PADDING = "8px";

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
  raid: "raid",
  references: "reference/references",
  referenceTopics: "reference/reference-topics",
} as const;

// ─── Tags ──────────────────────────────────────────────────────────────────

export const ENTITY_TAGS = {
  client: "#client",
  engagement: "#engagement",
  project: "#project",
  person: "#person",
  reference: "#reference",
  referenceTopic: "#reference-topic",
  raid: "#raid",
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
  RAID_TYPE: "raid-type",
  LIKELIHOOD: "likelihood",
  IMPACT: "impact",
  RAISED_DATE: "raised-date",
  CLOSED_DATE: "closed-date",
  OWNER: "owner",
  TASKS_FILTERS: "pm-tasks-filters", // Legacy flat key — read-only fallback; migrated forward into VIEW_STATE (do NOT change without a migration)
  VIEW_STATE: "pm-view-state", // Namespaced parent holding per-block dashboard state (pm-view-state.<blockKey>)
  TOPICS: "topics",
  PM_REFERENCES_FILTERS: "pm-references-filters",
  RAID_DASHBOARD_FILTERS: "pm-raid-dashboard-filters",
  PARENT: "parent",
} as const;

// ─── Action-context fields ────────────────────────────────────────────────

/** Field identifiers carried on the pending action context to pre-select a parent. */
export const ACTION_CTX_FIELD = {
  CLIENT: "client",
  ENGAGEMENT: "engagement",
  RECURRING_MEETING: "recurring-meeting",
} as const;

// ─── CSS classes ──────────────────────────────────────────────────────────

/** CSS class name strings used in DOM construction. */
export const CSS_CLS = {
  PM_ERROR: "pm-error",
  INTERNAL_LINK: "internal-link",
  PROPERTIES_FORM: "pm-properties",
  // Action processor classes
  ACTIONS_WRAPPER: "pm-actions",
  ACTIONS_BUTTON: "pm-actions__button",
  MOD_CTA: "mod-cta",
  MOD_DESTRUCTIVE: "mod-destructive",
  // Status badge
  STATUS_BADGE: "pm-status-badge",
  STATUS_BADGE_PREFIX: "pm-status-badge--",
  // Property renderer
  PROPERTIES_ROW: "pm-properties__row",
  PROPERTIES_LABEL: "pm-properties__label",
  PROPERTIES_INPUT: "pm-properties__input",
  PROPERTIES_TEXTAREA: "pm-properties__textarea",
  PROPERTIES_SELECT: "pm-properties__select",
  // DOM helpers / filter UI
  TASKS_FILTER_SELECT: "pm-tasks-filter-select",
  FILTER_SECTION: "pm-filter-section",
  FILTER_SECTION_TITLE: "pm-filter-section__title",
  FILTER_SECTION_CONTENT: "pm-filter-section__content",
  // Task list
  TASK_LIST: "pm-task-list",
  TASK_TEXT: "pm-task-text",
  TASK_DUE: "pm-task-due",
  TASK_DUE_OVERDUE: "pm-task-due--overdue",
  TASK_PRIORITY: "pm-task-priority",
  TASK_SOURCE: "pm-task-source",
  // List suggester chips
  PROPERTIES_LIST_SUGGESTER: "pm-properties__list-suggester",
  PROPERTIES_CHIPS: "pm-properties__chips",
  PROPERTIES_CHIP: "pm-properties__chip",
  PROPERTIES_CHIP_REMOVE: "pm-properties__chip-remove",
  // RAID references processor
  RAID_REFERENCES_ITEM_TEXT: "pm-raid-references__item-text",
  RAID_REFERENCES_ITEM_SECTION_BODY: "pm-raid-references__item-section-body",
  // RAID dashboard processor
  RAID_DASHBOARD: "pm-raid-dashboard",
  RAID_DASHBOARD_OUTPUT: "pm-raid-dashboard__output",
  RAID_DASHBOARD_FILTER_PANEL: "pm-raid-dashboard__filters",
  RAID_DASHBOARD_FILTER_ROW: "pm-raid-dashboard__filter-row",
  RAID_DASHBOARD_FILTER_LABEL: "pm-raid-dashboard__filter-label",
  RAID_DASHBOARD_CHIPS: "pm-raid-dashboard__chips",
  RAID_DASHBOARD_SEARCH: "pm-raid-dashboard__search",
  RAID_DASHBOARD_COUNTS: "pm-raid-dashboard__counts",
  RAID_DASHBOARD_SECTION: "pm-raid-dashboard__section",
  RAID_CHIP: "raid-chip",
  RAID_CHIP_ACTIVE: "raid-chip--active",
  RAID_MATRIX_WRAPPER: "raid-matrix-wrapper",
  RAID_MATRIX: "raid-matrix",
  RAID_MATRIX_CELL: "raid-matrix-cell",
  RAID_MATRIX_CELL_HEADER: "raid-matrix-cell--header",
  RAID_MATRIX_CELL_SELECTED: "raid-matrix-cell--selected",
  RAID_SECTION_HEADER: "raid-section-header",
  RAID_ITEM_TABLE: "raid-item-table",
  RAID_ITEM_ROW: "raid-item-row",
  RAID_STATUS_BADGE: "raid-status-badge",
  RAID_LXI_DOT: "raid-lxi-dot",
  RAID_AGE_PILL: "raid-age-pill",
  RAID_OWNER_AVATAR: "raid-owner-avatar",
  // RAID matrix likelihood×impact cell colours (keyed in MATRIX_CELL_CLASS)
  RAID_CELL_HH: "raid-cell--hh",
  RAID_CELL_HM: "raid-cell--hm",
  RAID_CELL_HL: "raid-cell--hl",
  RAID_CELL_MH: "raid-cell--mh",
  RAID_CELL_MM: "raid-cell--mm",
  RAID_CELL_ML: "raid-cell--ml",
  RAID_CELL_LH: "raid-cell--lh",
  RAID_CELL_LM: "raid-cell--lm",
  RAID_CELL_LL: "raid-cell--ll",
  // RAID status badge colours (keyed in STATUS_CSS)
  RAID_STATUS_OPEN: "raid-status--open",
  RAID_STATUS_IN_PROGRESS: "raid-status--in-progress",
  RAID_STATUS_RESOLVED: "raid-status--resolved",
  RAID_STATUS_CLOSED: "raid-status--closed",
  // Task view processors (dashboard + by-project)
  TASKS_DASHBOARD: "pm-tasks-dashboard",
  TASKS_DASHBOARD_OUTPUT: "pm-tasks-dashboard__output",
  TASKS_BY_PROJECT: "pm-tasks-by-project",
  TASKS_BY_PROJECT_OUTPUT: "pm-tasks-by-project__output",
  // Task dashboard filter drawer
  TASKS_DRAWER_SECTION: "pm-tasks-drawer__section",
  TASKS_DRAWER_SECTION_LABEL: "pm-tasks-drawer__section-label",
  // Obsidian built-in task classes (NOT plugin pm-* classes). Obsidian emits
  // these on rendered markdown task lists; we reuse them so checkbox lookup
  // and persistence stay in sync with Obsidian's own DOM output.
  TASK_LIST_ITEM: "task-list-item",
  TASK_LIST_ITEM_CHECKBOX: "task-list-item-checkbox",
} as const;

/** User-facing text for the task dashboard filter drawer's tag section. */
export const TASK_DRAWER_TEXT = {
  TAGS_LABEL: "🏷 TAGS",
  TAG_FILTER_PLACEHOLDER: "type…",
  TAG_FILTER_ARIA: "Filter by tag",
  INCLUDE_UNTAGGED_LABEL: "Include untagged",
} as const;

/** Composed DOM selector strings built from Obsidian's built-in task classes. */
export const CSS_SELECTOR = {
  /** Matches every checkbox input inside a rendered task-list item. */
  TASK_LIST_CHECKBOX: `li.${CSS_CLS.TASK_LIST_ITEM} input.${CSS_CLS.TASK_LIST_ITEM_CHECKBOX}`,
} as const;

// ─── DOM primitives ───────────────────────────────────────────────────────

/** HTML element tag names used when building DOM (createEl / createElement). */
export const HTML_TAG = {
  ANCHOR: "a",
  EM: "em",
  H2: "h2",
  H3: "h3",
  H4: "h4",
  H5: "h5",
  BUTTON: "button",
  INPUT: "input",
  TABLE: "table",
  THEAD: "thead",
  TBODY: "tbody",
  TR: "tr",
  TH: "th",
  TD: "td",
} as const;

/** DOM attribute names set when building elements. */
export const DOM_ATTR = {
  HREF: "href",
  DATA_HREF: "data-href",
} as const;

/** Input element `type` attribute values. */
export const INPUT_TYPE = {
  TEXT: "text",
} as const;

/** DOM event names passed to addEventListener. */
export const DOM_EVENT = {
  CLICK: "click",
  KEYDOWN: "keydown",
  INPUT: "input",
} as const;

/** Obsidian vault event names. */
export const VAULT_EVENT = {
  MODIFY: "modify",
} as const;

/** User-facing action-button labels shared across modals. */
export const ACTION_LABEL = {
  CREATE: "Create",
  SAVE: "Save",
  OK: "OK",
  CANCEL: "Cancel",
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
  PM_RAID_REFERENCES: "pm-raid-references",
  PM_RAID_DASHBOARD: "pm-raid-dashboard",
  PM_REFERENCES: "pm-references",
} as const;

// ─── Processor & view identifiers ─────────────────────────────────────────

/** View mode strings used by the task dashboard grouping selector. */
export const VIEW_MODE = {
  CONTEXT: "context",
  DATE: "date",
  PRIORITY: "priority",
  TAG: "tag",
} as const;

/** Type values for the pm-table codeblock. */
export const TABLE_TYPE = {
  CLIENT_ENGAGEMENTS: "client-engagements",
  CLIENT_PEOPLE: "client-people",
  ENGAGEMENT_PROJECTS: "engagement-projects",
  RELATED_PROJECT_NOTES: "related-project-notes",
  MENTIONS: "mentions",
} as const;

// ─── User-facing messages ─────────────────────────────────────────────────

/** Repeated user-facing Notice and error message strings. */
export const MSG = {
  NO_NAME: "No name provided.",
  CANCELLED: "Creation cancelled.",
  DATAVIEW_UNAVAILABLE: "Dataview is not available. Install and enable the Dataview plugin.",
  RAID_REFERENCE_TAGGED_LINE: "Tagged line as RAID reference.",
  RAID_REFERENCE_TAGGED_SECTION: (heading: string) =>
    `Tagged section "${heading}" as RAID reference.`,
  TASK_TOGGLE_FAILED: "Project Manager: failed to save task change to the event note.",
  VAULT_SETUP_SUCCESS: "Project Manager: Vault structure set up successfully.",
} as const;

/** Task-dashboard output messages (empty state, unknown view mode, error banner). */
export const TASK_DASHBOARD_MSG = {
  NO_TASKS_MATCH: "No tasks match the current filters.",
  UNKNOWN_VIEW_MODE: (mode: string): string => `Unknown view mode: ${mode}`,
  ERROR: (detail: string): string => `pm-tasks error: ${detail}`,
} as const;

/** pm-tasks code-block `mode` values. */
export const PM_TASKS_MODE = {
  DASHBOARD: "dashboard",
  BY_PROJECT: "by-project",
} as const;

/**
 * The RAID dashboard has a single composite view (matrix + counts + grouped
 * tables render together), so it registers one renderer under this mode.
 */
export const RAID_VIEW_MODE = {
  MATRIX: "matrix",
} as const;

/** User-facing messages for the pm-raid-dashboard code block. */
export const RAID_DASHBOARD_MSG = {
  NO_ITEMS_MATCH: "No RAID items match the current filters.",
  UNKNOWN_VIEW_MODE: (mode: string): string => `Unknown view mode: ${mode}`,
  ERROR: (detail: string): string => `pm-raid-dashboard error: ${detail}`,
  INVALID_CONFIG: "Invalid pm-raid-dashboard config.",
} as const;

/** User-facing labels and text formatters for the RAID dashboard UI. */
export const RAID_DASHBOARD_TEXT = {
  TYPE_LABEL: "Type",
  STATUS_LABEL: "Status",
  CLIENTS_LABEL: "Clients",
  ENGAGEMENTS_LABEL: "Engagements",
  CLIENT_FILTER_PLACEHOLDER: "Filter by client…",
  CLIENT_FILTER_ARIA: "Filter by client",
  ENGAGEMENT_FILTER_PLACEHOLDER: "Filter by engagement…",
  ENGAGEMENT_FILTER_ARIA: "Filter by engagement",
  SEARCH_PLACEHOLDER: "Search items…",
  MATRIX_HEADING: "Likelihood × Impact",
  ITEM_TABLE_HEADERS: ["Title", "Status", "L×I", "Age", "Owner"],
  COUNT_SEPARATOR: " | ",
  typeCount: (raidType: string, count: number): string => `${raidType}s: ${count}`,
  sectionTitle: (raidType: string): string => `${raidType}s`,
  agePill: (days: number): string => `${days}d`,
  lxiLabel: (likelihood: string, impact: string): string =>
    `${likelihood.charAt(0)}×${impact.charAt(0)}`,
} as const;

/** pm-tasks processor config-validation error messages. */
export const PM_TASKS_MSG = {
  INVALID_CONFIG: "Invalid pm-tasks config.",
  REQUIRES_MODE: "pm-tasks requires a `mode` field (dashboard or by-project).",
  UNKNOWN_MODE: (mode: string): string => `Unknown pm-tasks mode: ${mode}`,
  MIGRATION_FAILED: (detail: string): string => `pm-tasks filter-state migration failed: ${detail}`,
} as const;

// ─── Command layer: names, modals, error labels ───────────────────────────

/** Command palette display names, keyed like COMMAND_IDS. */
export const COMMAND_NAMES = {
  CREATE_CLIENT: "PM: Create Client",
  CREATE_ENGAGEMENT: "PM: Create Engagement",
  CREATE_PROJECT: "PM: Create Project",
  CREATE_PERSON: "PM: Create Person",
  CREATE_INBOX: "PM: Create Inbox Note",
  CREATE_SINGLE_MEETING: "PM: Create Single Meeting",
  CREATE_RECURRING_MEETING: "PM: Create Recurring Meeting",
  CREATE_RECURRING_MEETING_EVENT: "PM: Create Recurring Meeting Event",
  CREATE_PROJECT_NOTE: "PM: Create Project Note",
  CONVERT_INBOX: "PM: Convert Inbox to Project",
  CONVERT_SINGLE_TO_RECURRING: "PM: Convert Single Meeting to Recurring",
  SCAFFOLD_VAULT: "PM: Set Up Vault Structure",
  CREATE_RAID_ITEM: "PM: Create RAID Item",
  TAG_RAID_REFERENCE: "PM: Tag Line as RAID Reference",
  CREATE_REFERENCE_TOPIC: "PM: Create Reference Topic",
  UPDATE_REFERENCE_TOPIC: "PM: Update Reference Topic",
  CREATE_REFERENCE: "PM: Create Reference",
  OPEN_REFERENCE_DASHBOARD: "PM: Open Reference Dashboard",
} as const;

/** Optional-parent picker labels shared across entity-creation modals. */
export const PARENT_LABEL = {
  CLIENT_OPTIONAL: "Client (optional)",
  ENGAGEMENT_OPTIONAL: "Engagement (optional)",
  OWNER_OPTIONAL: "Owner (optional)",
} as const;

/** Display label for the "no selection" sentinel item in RAID pickers. */
export const RAID_PICKER_NONE_LABEL = "(None)";

/** Modal titles and input placeholders for command flows, keyed like COMMAND_IDS. */
export const CMD_MODAL = {
  CREATE_CLIENT: { title: "New client name:", placeholder: "e.g. Acme Corp" },
  CREATE_ENGAGEMENT: { title: "New Engagement", placeholder: "Engagement name" },
  CREATE_PROJECT: { title: "New Project", placeholder: "Project name" },
  CREATE_PERSON: { title: "New Person", placeholder: "Person name" },
  CREATE_INBOX: { title: "New Inbox Note", placeholder: "Note name" },
  CREATE_SINGLE_MEETING: { title: "New Single Meeting", placeholder: "Meeting name" },
  CREATE_RECURRING_MEETING: { title: "New Recurring Meeting", placeholder: "Meeting name" },
  CONVERT_INBOX: { title: "Project name:", placeholder: "Project name" },
  CONVERT_SINGLE_TO_RECURRING: { title: "Recurring meeting name:", placeholder: "Meeting name" },
  CREATE_PROJECT_NOTE: { title: "New project note name:", placeholder: "Note name" },
  CREATE_RAID_ITEM: { title: "RAID item name" },
} as const;

/** Error-message labels (prefix before `: ${String(err)}`) for command error Notices. */
export const CMD_ERROR_LABEL = {
  CREATE_CLIENT: "Error creating client",
  CREATE_ENGAGEMENT: "Error creating engagement",
  CREATE_PROJECT: "Error creating project",
  CREATE_PERSON: "Error creating person",
  CREATE_INBOX: "Error creating inbox note",
  CREATE_SINGLE_MEETING: "Error creating meeting",
  CREATE_RECURRING_MEETING: "Error creating recurring meeting",
  CREATE_RECURRING_MEETING_EVENT: "Error creating event",
  CREATE_PROJECT_NOTE: "Error creating project note",
  CONVERT_INBOX_TO_PROJECT: "Error converting inbox to project",
  CONVERT_SINGLE_TO_RECURRING: "Error converting meeting",
  CREATE_RAID_ITEM: "Error creating RAID item",
  CREATE_REFERENCE: "Error creating reference",
  TAG_RAID_REFERENCE: "Error tagging line",
  GENERIC: "Error",
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

/** Success-notice label shown when an entity note is created. */
export const CREATED_LABEL = "Created";

/** Newline character used when composing multi-line note content. */
export const NL = "\n";

/** Display label for the "no value" option prepended to nullable select fields. */
export const SELECT_NONE_LABEL = "(none)";
/** Sentinel value marking the "no value" option / an unset nullable select field. */
export const SELECT_NONE_VALUE = "";

/** Inbox note status options (separate from entity statuses). */
export const INBOX_STATUSES = ["Active", "Complete"] as const;

/** Length of a datetime-local input string (YYYY-MM-DDTHH:mm). */
export const ISO_DATETIME_INPUT_LENGTH = 16;

// ─── Plugin identifiers ────────────────────────────────────────────────────

export const DATAVIEW_PLUGIN_ID = "dataview";
export const TASKS_PLUGIN_ID = "obsidian-tasks-plugin";

/** Obsidian view type for the Reference Dashboard ItemView panel. */
export const PM_REFERENCE_DASHBOARD_VIEW_TYPE = "pm-reference-dashboard";
