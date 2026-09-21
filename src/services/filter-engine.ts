import type {
  DataviewTask,
  DataviewApi,
  DashboardFilters,
  DueDateFilter,
  StartDateFilter,
  ScheduledDateFilter,
  MeetingDateFilter,
  ProjectStatus,
  InboxStatusFilter,
} from "../types";
import { todayISO } from "../utils/date-utils";
import { getTaskContext, getTaskPriority, addDays } from "../utils/task-utils";
import {
  CONTEXT,
  STATUS,
  WEEK_DAYS,
  ISO_DATE_LENGTH,
  VIEW_MODE,
  TOMORROW_OFFSET,
  NEXT_WEEK_START_OFFSET,
  NEXT_WEEK_END_OFFSET,
  FACET_KEY,
  DUE_DATE_PRESET,
  START_DATE_PRESET,
  SCHEDULED_DATE_PRESET,
  MEETING_DATE_FILTER,
  INBOX_STATUS_FILTER,
} from "../constants";
import type { ContextFilterField } from "../constants";
import type { FolderSettings } from "../settings";
import type { IEntityHierarchyService } from "./interfaces";

/**
 * ─── Generic, dependency-free filter engine ─────────────────────────────────
 *
 * A `FilterSpec` is a *static* catalog of facets. Each facet knows how to match
 * a single item against a selected value; any external dependencies it needs
 * (`dv`, `hierarchyService`, `folders`) are captured in the predicate closure
 * when the spec is built, so the engine itself never touches them.
 *
 * A `FilterState` is the *dynamic* half: which facets are selected (and to what
 * value) plus the current `viewMode`.
 *
 * `FilterEngine.apply(items, spec, state)` is a pure function — no I/O, no deps.
 */

/** A single filterable dimension. */
export interface Facet<Item = unknown, Value = unknown> {
  /** Stable identity — also the key looked up in `FilterState.selections`. */
  key: string;
  /**
   * Extracts the comparable value from an item. Used by the default matcher
   * when no `predicate` is supplied (selected array `.includes(accessor(item))`).
   */
  accessor?: (item: Item) => unknown;
  /**
   * Full match predicate. Receives the item and the selected value only — any
   * other dependency is captured by closure. Returns true if the item passes.
   */
  predicate?: (item: Item, selected: Value) => boolean;
  /**
   * View-mode gate. When present and it returns false for the current view mode,
   * the engine skips this facet entirely (even if a selection exists).
   */
  appliesWhen?: (viewMode: string) => boolean;
}

/** Static facet catalog. */
export interface FilterSpec<Item = unknown> {
  facets: Facet<Item>[];
  /** Returns a copy of this spec with the named facet removed. */
  specWithout(key: string): FilterSpec<Item>;
}

/** Dynamic selection state. */
export interface FilterState {
  /** Maps a facet key → its selected value. Absent key = facet inactive. */
  selections: Record<string, unknown>;
  viewMode: string;
}

/** Builds a `FilterSpec` from a facet list, wiring up `specWithout`. */
export function createFilterSpec<Item>(facets: Facet<Item>[]): FilterSpec<Item> {
  return {
    facets,
    specWithout(key: string): FilterSpec<Item> {
      return createFilterSpec(facets.filter((f) => f.key !== key));
    },
  };
}

function matchFacet<Item>(facet: Facet<Item>, item: Item, selected: unknown): boolean {
  if (facet.predicate) return facet.predicate(item, selected);
  const value = facet.accessor ? facet.accessor(item) : undefined;
  if (Array.isArray(selected)) return selected.includes(value);
  return value === selected;
}

export const FilterEngine = {
  /**
   * Pure conjunctive filter: keeps items that pass every *active, applicable*
   * facet. A facet is skipped when `appliesWhen(viewMode)` is false or when the
   * state carries no selection for its key. Exclusion of one facet is expressed
   * as `apply(items, spec.specWithout(key), state)` — no `excludeFacet` param.
   */
  apply<Item>(items: Item[], spec: FilterSpec<Item>, state: FilterState): Item[] {
    let result = items;
    for (const facet of spec.facets) {
      if (facet.appliesWhen && !facet.appliesWhen(state.viewMode)) continue;
      if (!Object.prototype.hasOwnProperty.call(state.selections, facet.key)) continue;
      const selected = state.selections[facet.key];
      if (selected === undefined) continue;
      result = result.filter((item) => matchFacet(facet, item, selected));
    }
    return result;
  },
};

/**
 * ─── Task-domain pure matchers ──────────────────────────────────────────────
 *
 * These are the single-item matching cores shared by both the task facets below
 * and the public `TaskFilterService` methods (which delegate to them). Keeping
 * them here makes the facet predicates one-liners and prevents drift.
 */

export interface TaskFacetDeps {
  folders: FolderSettings;
  dv: DataviewApi;
  hierarchyService: IEntityHierarchyService;
}

/** Client/engagement selection shape carried in `FilterState.selections`. */
export interface EntitySelection {
  names: string[];
  includeUnassigned: boolean;
}

/** Tag selection shape carried in `FilterState.selections`. */
export interface TagSelection {
  tags: string[];
  includeUntagged: boolean;
}

export function isDueDateFilterActive(filter: DueDateFilter): boolean {
  return filter.selectedPresets.length > 0 || filter.rangeFrom !== null || filter.rangeTo !== null;
}

/** Whether a task's due date satisfies the due-date filter (preset buckets OR explicit range). */
export function dueDateMatches(task: DataviewTask, filter: DueDateFilter): boolean {
  if (!isDueDateFilterActive(filter)) return true;

  const due = task.due ? String(task.due).substring(0, ISO_DATE_LENGTH) : null;

  if (due === null) {
    return filter.selectedPresets.includes(DUE_DATE_PRESET.NO_DATE);
  }

  if (filter.rangeFrom !== null || filter.rangeTo !== null) {
    const inRange =
      (filter.rangeFrom === null || due >= filter.rangeFrom) &&
      (filter.rangeTo === null || due <= filter.rangeTo);
    if (inRange) return true;
  }

  if (filter.selectedPresets.length > 0) {
    const today = todayISO();
    const tomorrow = addDays(today, TOMORROW_OFFSET);
    const weekEnd = addDays(today, WEEK_DAYS);
    const nextWeekStart = addDays(today, NEXT_WEEK_START_OFFSET);
    const nextWeekEnd = addDays(today, NEXT_WEEK_END_OFFSET);

    const presetMatchers: Partial<Record<string, (d: string) => boolean>> = {
      [DUE_DATE_PRESET.TODAY]: (d) => d === today,
      [DUE_DATE_PRESET.TOMORROW]: (d) => d === tomorrow,
      [DUE_DATE_PRESET.THIS_WEEK]: (d) => d >= today && d <= weekEnd,
      [DUE_DATE_PRESET.NEXT_WEEK]: (d) => d >= nextWeekStart && d <= nextWeekEnd,
      [DUE_DATE_PRESET.OVERDUE]: (d) => d < today,
    };

    for (const preset of filter.selectedPresets) {
      if (preset === DUE_DATE_PRESET.NO_DATE) continue;
      if (presetMatchers[preset]?.(due)) return true;
    }
  }

  return false;
}

/**
 * Shared shape for the start/scheduled date filters: a single no-date preset
 * plus an optional inclusive From/To range. Reads accept either concrete filter
 * via structural typing (both narrow `selectedPresets` to a preset union).
 */
interface NoDateRangeFilter {
  selectedPresets: readonly string[];
  rangeFrom: string | null;
  rangeTo: string | null;
}

/** Whether a no-date-preset-plus-range filter carries any active constraint. */
function isNoDateRangeFilterActive(filter: NoDateRangeFilter): boolean {
  return filter.selectedPresets.length > 0 || filter.rangeFrom !== null || filter.rangeTo !== null;
}

/**
 * Core matcher for the start/scheduled filters: an inactive filter matches all;
 * an undated task matches only via the no-date preset; a dated task matches when
 * it falls inside the inclusive range (undated tasks are never range-matched).
 */
function noDateRangeMatches(dateValue: unknown, filter: NoDateRangeFilter, noDatePreset: string): boolean {
  if (!isNoDateRangeFilterActive(filter)) return true;

  const date = dateValue ? String(dateValue).substring(0, ISO_DATE_LENGTH) : null;

  if (date === null) {
    return filter.selectedPresets.includes(noDatePreset);
  }

  if (filter.rangeFrom !== null || filter.rangeTo !== null) {
    return (
      (filter.rangeFrom === null || date >= filter.rangeFrom) &&
      (filter.rangeTo === null || date <= filter.rangeTo)
    );
  }

  return false;
}

/** Whether the start-date filter carries any active constraint (no-date preset or range). */
export function isStartDateFilterActive(filter: StartDateFilter): boolean {
  return isNoDateRangeFilterActive(filter);
}

/** Whether a task's start date satisfies the start-date filter (no-date preset or inclusive range). */
export function startDateMatches(task: DataviewTask, filter: StartDateFilter): boolean {
  return noDateRangeMatches(task.start, filter, START_DATE_PRESET.NO_DATE);
}

/** Whether the scheduled-date filter carries any active constraint (no-date preset or range). */
export function isScheduledDateFilterActive(filter: ScheduledDateFilter): boolean {
  return isNoDateRangeFilterActive(filter);
}

/** Whether a task's scheduled date satisfies the scheduled-date filter (no-date preset or inclusive range). */
export function scheduledDateMatches(task: DataviewTask, filter: ScheduledDateFilter): boolean {
  return noDateRangeMatches(task.scheduled, filter, SCHEDULED_DATE_PRESET.NO_DATE);
}

/** Whether a task's tags satisfy the tag filter (or it is untagged and untagged are included). */
export function tagMatches(task: DataviewTask, tagFilter: string[], includeUntagged: boolean): boolean {
  if (tagFilter.length === 0 && !includeUntagged) return true;

  const taskTags: string[] = task.tags ?? [];
  const isUntagged = taskTags.length === 0;

  if (isUntagged) return includeUntagged;
  return tagFilter.some((tag) => taskTags.includes(tag));
}

/** Whether an ISO date string falls within the selected meeting-date bucket. */
export function meetingDateMatches(dateStr: string, filter: MeetingDateFilter): boolean {
  const today = todayISO();
  const weekEnd = addDays(today, WEEK_DAYS);
  const d = dateStr.substring(0, ISO_DATE_LENGTH);

  const meetingMatchers: Partial<Record<MeetingDateFilter, (s: string) => boolean>> = {
    [MEETING_DATE_FILTER.TODAY]: (s) => s === today,
    [MEETING_DATE_FILTER.THIS_WEEK]: (s) => s >= today && s <= weekEnd,
    [MEETING_DATE_FILTER.PAST]: (s) => s < today,
  };

  return meetingMatchers[filter]?.(d) ?? true;
}

/** Whether a raw page status value satisfies the inbox status filter. */
export function inboxStatusMatches(pageStatus: unknown, filter: InboxStatusFilter): boolean {
  if (filter === INBOX_STATUS_FILTER.ALL) return true;
  const isActive = String(pageStatus) !== STATUS.COMPLETE;
  return filter === STATUS.ACTIVE ? isActive : !isActive;
}

/** Whether a task's resolved client is in the selection; resolves the client via the passed deps. */
export function clientMatches(task: DataviewTask, sel: EntitySelection, deps: TaskFacetDeps): boolean {
  const { names, includeUnassigned } = sel;
  const { dv, hierarchyService } = deps;

  if (names.length === 0 && !includeUnassigned) return true;

  const page = dv.page(task.path);
  if (!page) return false;

  const taskClient = hierarchyService.resolveClientName(page);

  if (includeUnassigned && !taskClient) return true;
  if (names.length === 0) return includeUnassigned ? !taskClient : false;
  return taskClient !== null && names.includes(taskClient);
}

/** Whether a task's resolved engagement is in the selection; resolves it via the passed deps. */
export function engagementMatches(task: DataviewTask, sel: EntitySelection, deps: TaskFacetDeps): boolean {
  const { names, includeUnassigned } = sel;
  const { dv, hierarchyService } = deps;

  if (names.length === 0 && !includeUnassigned) return true;

  const page = dv.page(task.path);
  if (!page) return false;
  const taskEngagement = hierarchyService.resolveEngagementName(page);

  if (includeUnassigned && !taskEngagement) return true;
  if (names.length === 0) return includeUnassigned ? !taskEngagement : false;
  return taskEngagement !== null && names.includes(taskEngagement);
}

/** projectStatus context facet core. */
function projectStatusMatches(
  task: DataviewTask,
  statuses: ProjectStatus[],
  folders: FolderSettings,
  dv: DataviewApi
): boolean {
  if (getTaskContext(task, folders) !== CONTEXT.PROJECT) return true;
  const page = dv.page(task.path);
  return page !== null && statuses.includes(String(page.status) as ProjectStatus);
}

/** inboxStatus context facet core. */
function inboxStatusContextMatches(
  task: DataviewTask,
  filter: InboxStatusFilter,
  folders: FolderSettings,
  dv: DataviewApi
): boolean {
  if (getTaskContext(task, folders) !== CONTEXT.INBOX) return true;
  const page = dv.page(task.path);
  if (!page) return true;
  const isActive = page.status !== STATUS.COMPLETE;
  return filter === STATUS.ACTIVE ? isActive : !isActive;
}

/** meetingDate context facet core. */
function meetingDateContextMatches(
  task: DataviewTask,
  filter: MeetingDateFilter,
  folders: FolderSettings,
  dv: DataviewApi
): boolean {
  const ctx = getTaskContext(task, folders);
  if (ctx !== CONTEXT.MEETING && ctx !== CONTEXT.RECURRING_MEETING) return true;
  const page = dv.page(task.path);
  if (!page?.date) return filter === MEETING_DATE_FILTER.ALL;
  return meetingDateMatches(String(page.date), filter);
}

/**
 * ─── Task FilterSpec builders ───────────────────────────────────────────────
 */

const isContextView = (vm: string): boolean => vm === VIEW_MODE.CONTEXT;

/** The three CONTEXT-view-gated facets (projectStatus / inboxStatus / meetingDate). */
function buildContextFacets(folders: FolderSettings, dv: DataviewApi): Facet<DataviewTask>[] {
  return [
    {
      key: FACET_KEY.PROJECT_STATUS,
      appliesWhen: isContextView,
      predicate: (task, statuses) => projectStatusMatches(task, statuses as ProjectStatus[], folders, dv),
    },
    {
      key: FACET_KEY.INBOX_STATUS,
      appliesWhen: isContextView,
      predicate: (task, filter) => inboxStatusContextMatches(task, filter as InboxStatusFilter, folders, dv),
    },
    {
      key: FACET_KEY.MEETING_DATE,
      appliesWhen: isContextView,
      predicate: (task, filter) => meetingDateContextMatches(task, filter as MeetingDateFilter, folders, dv),
    },
  ];
}

/** Full task facet catalog. Deps are captured in the predicate closures. */
export function buildTaskFacets(deps: TaskFacetDeps): Facet<DataviewTask>[] {
  const { folders, dv } = deps;
  return [
    // showCompleted: active only when hiding completed; selected value ignored.
    { key: FACET_KEY.SHOW_COMPLETED, predicate: (task) => !task.completed },
    // context: accessor + default array-includes.
    { key: FACET_KEY.CONTEXT, accessor: (task) => getTaskContext(task, folders) },
    { key: FACET_KEY.SEARCH_TEXT, predicate: (task, text) => task.text.toLowerCase().includes(text as string) },
    { key: FACET_KEY.DUE_DATE, predicate: (task, filter) => dueDateMatches(task, filter as DueDateFilter) },
    { key: FACET_KEY.START_DATE, predicate: (task, filter) => startDateMatches(task, filter as StartDateFilter) },
    { key: FACET_KEY.SCHEDULED_DATE, predicate: (task, filter) => scheduledDateMatches(task, filter as ScheduledDateFilter) },
    { key: FACET_KEY.PRIORITY, accessor: (task) => getTaskPriority(task) },
    {
      key: FACET_KEY.CLIENT,
      predicate: (task, sel) => clientMatches(task, sel as EntitySelection, deps),
    },
    {
      key: FACET_KEY.ENGAGEMENT,
      predicate: (task, sel) => engagementMatches(task, sel as EntitySelection, deps),
    },
    {
      key: FACET_KEY.TAG,
      predicate: (task, sel) => tagMatches(task, (sel as TagSelection).tags, (sel as TagSelection).includeUntagged),
    },
    ...buildContextFacets(folders, dv),
  ];
}

/** Full task FilterSpec (facet catalog + specWithout). */
export function buildTaskFilterSpec(deps: TaskFacetDeps): FilterSpec<DataviewTask> {
  return createFilterSpec(buildTaskFacets(deps));
}

/**
 * Derives the dynamic `FilterState` from a `DashboardFilters` object. A facet
 * key is added to `selections` only when its filter is *active* (this is what
 * makes the engine's "no selection ⇒ skip" rule reproduce the original guards).
 */
export function buildTaskFilterState(f: DashboardFilters): FilterState {
  const selections: Record<string, unknown> = {};

  if (!f.showCompleted) selections[FACET_KEY.SHOW_COMPLETED] = false;
  if (f.contextFilter.length > 0) selections[FACET_KEY.CONTEXT] = f.contextFilter;
  if (f.searchText) selections[FACET_KEY.SEARCH_TEXT] = f.searchText;
  if (isDueDateFilterActive(f.dueDateFilter)) selections[FACET_KEY.DUE_DATE] = f.dueDateFilter;
  if (isStartDateFilterActive(f.startDateFilter)) selections[FACET_KEY.START_DATE] = f.startDateFilter;
  if (isScheduledDateFilterActive(f.scheduledDateFilter)) selections[FACET_KEY.SCHEDULED_DATE] = f.scheduledDateFilter;
  if (f.priorityFilter.length > 0) selections[FACET_KEY.PRIORITY] = f.priorityFilter;
  if (f.clientFilter.length > 0 || f.includeUnassignedClients) {
    selections[FACET_KEY.CLIENT] = { names: f.clientFilter, includeUnassigned: f.includeUnassignedClients };
  }
  if (f.engagementFilter.length > 0 || f.includeUnassignedEngagements) {
    selections[FACET_KEY.ENGAGEMENT] = { names: f.engagementFilter, includeUnassigned: f.includeUnassignedEngagements };
  }
  if ((f.tagFilter?.length ?? 0) > 0 || f.includeUntagged) {
    selections[FACET_KEY.TAG] = { tags: f.tagFilter ?? [], includeUntagged: f.includeUntagged ?? false };
  }

  // CONTEXT-view-gated selections: added when active; the engine's appliesWhen
  // gate suppresses them when viewMode !== "context".
  addContextSelections(selections, f);

  return { selections, viewMode: f.viewMode };
}

function addContextSelections(
  selections: Record<string, unknown>,
  f: Pick<DashboardFilters, ContextFilterField>
): void {
  if (f.projectStatusFilter.length > 0) selections[FACET_KEY.PROJECT_STATUS] = f.projectStatusFilter;
  if (f.inboxStatusFilter !== INBOX_STATUS_FILTER.ALL) selections[FACET_KEY.INBOX_STATUS] = f.inboxStatusFilter;
  if (f.meetingDateFilter !== MEETING_DATE_FILTER.ALL) selections[FACET_KEY.MEETING_DATE] = f.meetingDateFilter;
}

/**
 * Derives a CONTEXT-only `FilterState` (viewMode forced to "context") for the
 * standalone `applyContextSpecificFilters` entry point.
 */
export function buildContextFilterState(
  f: Pick<DashboardFilters, ContextFilterField>
): FilterState {
  const selections: Record<string, unknown> = {};
  addContextSelections(selections, f);
  return { selections, viewMode: VIEW_MODE.CONTEXT };
}
