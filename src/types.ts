/**
 * All shared type definitions for the Project Manager plugin.
 * Includes entity types, task types, code block configs, and Dataview API stubs.
 */

// ─── Entity Types ──────────────────────────────────────────────────────────

export type ClientStatus = "Active" | "Inactive";
export type EngagementStatus = "Active" | "Inactive";
export type ProjectStatus = "New" | "Active" | "On Hold" | "Complete";
export type TaskContext = "Project" | "Person" | "Meeting" | "Inbox" | "Daily Notes" | "Other";
export type TaskPriority = 1 | 2 | 3 | 4 | 5;
export type EntityType =
  | "client"
  | "engagement"
  | "project"
  | "person"
  | "inbox"
  | "single-meeting"
  | "recurring-meeting"
  | "project-note";

// ─── Parsed Task ───────────────────────────────────────────────────────────

export interface ParsedTask {
  text: string;
  completed: boolean;
  filePath: string;
  lineNumber: number;
  /** ISO date string from 📅 emoji */
  dueDate: string | null;
  /** ISO date string from ✅ emoji */
  completionDate: string | null;
  priority: TaskPriority;
  /** Recurrence string from 🔁 emoji */
  recurrence: string | null;
  tags: string[];
  /** Raw markdown line (without leading checkbox) */
  rawText: string;
}

// ─── Task Context Info ─────────────────────────────────────────────────────

export interface TaskContextInfo {
  context: TaskContext;
  /** For project notes: path to the parent project */
  parentProjectPath: string | null;
}

// ─── Code Block Configs ────────────────────────────────────────────────────

export interface PmTableConfig {
  type:
    | "client-engagements"
    | "client-people"
    | "engagement-projects"
    | "related-project-notes"
    | "mentions";
}

export interface PmPropertiesConfig {
  entity: EntityType;
}

export interface PmActionConfig {
  type: string;
  label: string;
  style?: "primary" | "default" | "destructive";
  /** Optional command ID to override default */
  commandId?: string;
  /** When set, the button pre-populates the named field in the target create command */
  context?: { field: string };
}

export interface PmActionsConfig {
  actions: PmActionConfig[];
}

export type TaskViewMode = "dashboard" | "by-project";
export type DueDateFilter = "All" | "Today" | "This Week" | "Overdue" | "No Date";
export type MeetingDateFilter = "All" | "Today" | "This Week" | "Past";
export type InboxStatusFilter = "All" | "Active" | "Inactive";
export type SortBy =
  | "none"
  | "dueDate-asc"
  | "dueDate-desc"
  | "priority-asc"
  | "priority-desc";

export interface PmTasksConfig {
  mode: TaskViewMode;
  // Dashboard-specific defaults
  viewMode?: "context" | "date" | "priority" | "tag";
  sortBy?: SortBy;
  showCompleted?: boolean;
  // Filtering defaults
  contextFilter?: TaskContext[];
  dueDateFilter?: DueDateFilter;
  priorityFilter?: TaskPriority[];
  projectStatusFilter?: ProjectStatus[];
  inboxStatusFilter?: InboxStatusFilter;
  meetingDateFilter?: MeetingDateFilter;
  // By-project defaults
  selectedStatuses?: ProjectStatus[];
}

// ─── Dataview API Type Stubs ───────────────────────────────────────────────

/** A single page returned by Dataview. Frontmatter properties are accessed dynamically. */
export interface DataviewPage {
  file: {
    name: string;
    path: string;
    folder: string;
    link: DataviewLink;
    tags: string[];
    mtime: { valueOf(): number; toISO(): string };
    tasks: DataviewArray<DataviewTask>;
  };
  // Frontmatter fields (dynamic)
  status?: string;
  client?: DataviewLink | string;
  engagement?: DataviewLink | string;
  relatedProject?: DataviewLink | string;
  notesDirectory?: string;
  priority?: number;
  "start-date"?: string;
  "end-date"?: string;
  date?: string;
  title?: string;
  "reports-to"?: DataviewLink | string;
  "contact-name"?: string;
  "contact-email"?: string;
  "contact-phone"?: string;
  notes?: string;
  description?: string;
  attendees?: Array<DataviewLink | string>;
  convertedFrom?: string;
  convertedTo?: string;
  [key: string]: unknown;
}

export interface DataviewLink {
  path: string;
  display?: string;
  embed?: boolean;
  type?: "file" | "header" | "block";
}

export interface DataviewTask {
  text: string;
  completed: boolean;
  path: string;
  line: number;
  link: DataviewLink;
  due?: unknown;
  tags?: string[];
  [key: string]: unknown;
}

export interface DataviewArray<T> {
  length: number;
  values: T[];
  where(predicate: (item: T) => boolean): DataviewArray<T>;
  sort<K>(key: (item: T) => K, order?: "asc" | "desc"): DataviewArray<T>;
  map<U>(mapper: (item: T) => U): DataviewArray<U>;
  filter(predicate: (item: T) => boolean): DataviewArray<T>;
  [Symbol.iterator](): Iterator<T>;
  [index: number]: T;
}

export interface DataviewApi {
  pages(source?: string): DataviewArray<DataviewPage>;
  page(path: string): DataviewPage | null;
  date(value: unknown): DataviewDate;
  func: {
    contains(value: unknown, target: unknown): boolean;
  };
}

export interface DataviewDate {
  equals(other: DataviewDate): boolean;
  plus(duration: { days?: number; weeks?: number }): DataviewDate;
  toString(): string;
  toISOString(): string;
  valueOf(): number;
}

// ─── Task Filter State ────────────────────────────────────────────────────

/** Filter/display state for the dashboard task view. */
export interface DashboardFilters {
  viewMode: "context" | "date" | "priority" | "tag";
  sortBy: SortBy;
  showCompleted: boolean;
  contextFilter: TaskContext[];
  dueDateFilter: DueDateFilter;
  priorityFilter: TaskPriority[];
  projectStatusFilter: ProjectStatus[];
  inboxStatusFilter: InboxStatusFilter;
  meetingDateFilter: MeetingDateFilter;
  clientFilter: string[];
  engagementFilter: string[];
  includeUnassignedClients: boolean;
  includeUnassignedEngagements: boolean;
  searchText: string;
}

/** Filter/display state for the by-project task view. */
export interface ByProjectFilters {
  selectedStatuses: ProjectStatus[];
  projectFilter: string;
  clientFilter: string[];
  engagementFilter: string[];
  includeUnassignedClients: boolean;
  includeUnassignedEngagements: boolean;
  showCompleted: boolean;
}

// ─── Plugin Internal Types ─────────────────────────────────────────────────

/** Represents a created or existing entity for display in suggesters. */
export interface EntityOption {
  name: string;
  path: string;
  status?: string;
  client?: string;
  engagement?: string;
}

/** Result of a file creation operation. */
export interface CreateFileResult {
  success: boolean;
  path: string;
  error?: string;
}
