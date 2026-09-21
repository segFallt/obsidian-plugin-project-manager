import type { TaskProcessorServices } from "../plugin-context";
import type {
  PmTasksConfig,
  DataviewTask,
  DataviewApi,
  DashboardFilters,
  SavedDashboardFilters,
  DueDateFilter,
  DueDatePreset,
  StartDateFilter,
  ScheduledDateFilter,
  MeetingDateFilter,
  InboxStatusFilter,
  SortKey,
  ProjectStatus,
  TaskContext,
  TaskPriority,
} from "../types";
import { CONTEXT, ENTITY_TAGS, TASK_CONTEXTS, TASK_PRIORITIES, DUE_DATE_PRESET, DUE_DATE_PRESETS, DEFAULT_DUE_DATE_FILTER, DEFAULT_START_DATE_FILTER, DEFAULT_SCHEDULED_DATE_FILTER, START_DATE_PRESET, SCHEDULED_DATE_PRESET, INBOX_STATUS_FILTER, MEETING_DATE_FILTER, TASK_PRIORITY_PILL_LABEL, DEBOUNCE_MS, MSG, TASK_DASHBOARD_MSG, LOG_CONTEXT, VIEW_MODE, CSS_CLS, HTML_TAG, INPUT_TYPE, DOM_EVENT, DOM_ATTR, TASK_DRAWER_TEXT, SORT_FIELD, SORT_DIRECTION } from "../constants";
import { debounced } from "../utils/debounce";
import { renderError } from "./dom-helpers";
import type { ITaskSortService } from "../services/interfaces";
import type { IEntityQuery } from "../services/entity-query";
import { buildTaskFilterSpec, buildTaskFilterState, isDueDateFilterActive, isStartDateFilterActive, isScheduledDateFilterActive } from "../services/filter-engine";
import { presetToDateRange } from "../utils/date-utils";
import type { TaskListRenderer } from "./task-list-renderer";
import { FilterChipSelect } from "../ui/components/filter-chip-select";
import { SortKeyBuilder } from "../ui/components/sort-key-builder";
import { ContextViewRenderer } from "./dashboard-views/context-view-renderer";
import { DateViewRenderer } from "./dashboard-views/date-view-renderer";
import { PriorityViewRenderer } from "./dashboard-views/priority-view-renderer";
import { TagViewRenderer } from "./dashboard-views/tag-view-renderer";
import { getTaskContext, getParentProjectPath, getParentRecurringMeetingPath } from "../utils/task-utils";
import type { TaskRenderHelpers } from "./view-renderer";
import { DashboardShell } from "./dashboard-shell";
import type { DashboardShellDeps } from "./dashboard-shell";

// ─── Sort-by string resolution ────────────────────────────────────────────────

/**
 * Maps a string `sortBy` value to the current SortKey[] format. Covers both the
 * pre-refactor composite strings persisted in saved data (which must stay
 * byte-identical) and the documented single-field string shorthands, so a block
 * authored as `sortBy: startDate-asc` resolves the same as the array form.
 */
const SORT_BY_STRING_MAP: Record<string, SortKey[]> = {
  "dueDate-asc": [{ field: SORT_FIELD.DUE_DATE, direction: SORT_DIRECTION.ASC }],
  "dueDate-desc": [{ field: SORT_FIELD.DUE_DATE, direction: SORT_DIRECTION.DESC }],
  "priority-asc": [{ field: SORT_FIELD.PRIORITY, direction: SORT_DIRECTION.ASC }],
  "priority-desc": [{ field: SORT_FIELD.PRIORITY, direction: SORT_DIRECTION.DESC }],
  "startDate-asc": [{ field: SORT_FIELD.START_DATE, direction: SORT_DIRECTION.ASC }],
  "startDate-desc": [{ field: SORT_FIELD.START_DATE, direction: SORT_DIRECTION.DESC }],
  "scheduledDate-asc": [{ field: SORT_FIELD.SCHEDULED_DATE, direction: SORT_DIRECTION.ASC }],
  "scheduledDate-desc": [{ field: SORT_FIELD.SCHEDULED_DATE, direction: SORT_DIRECTION.DESC }],
};

/** Resolves a persisted or authored `sortBy` value (string shorthand or current array) to `SortKey[]`. */
export function resolveSortBy(raw: unknown): SortKey[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as SortKey[];
  if (typeof raw === "string") return SORT_BY_STRING_MAP[raw] ?? [];
  return [];
}

/**
 * Structural view of a no-date-preset-plus-range filter (start/scheduled),
 * used by the shared range-section renderer so it need not know the concrete
 * filter type. Callers bridge back to the specific `StartDateFilter` /
 * `ScheduledDateFilter` in their `setFilter`.
 */
interface RangeDateFilterView {
  selectedPresets: readonly string[];
  rangeFrom: string | null;
  rangeTo: string | null;
}

/**
 * Renders the full dashboard mode: filter controls and all four view renderers
 * (context, date, priority, tag).
 */
export class DashboardView {
  private filters!: DashboardFilters;
  private outputEl!: HTMLElement;
  private searchControlsEl: HTMLElement | null = null;
  private readonly search = debounced(() => this.runDebouncedRefresh(), DEBOUNCE_MS.SEARCH);
  private chipSelects: FilterChipSelect[] = [];
  private isDrawerOpen = false;
  private chipsBarEl: HTMLElement | null = null;
  private drawerEl: HTMLElement | null = null;
  private filtersBtnEl: HTMLButtonElement | null = null;
  private filtersBadgeEl: HTMLElement | null = null;
  private drawerComponents: Array<{ destroy(): void }> = [];
  private readonly contextRenderer = new ContextViewRenderer();
  private readonly dateRenderer = new DateViewRenderer();
  private readonly priorityRenderer = new PriorityViewRenderer();
  private readonly tagRenderer = new TagViewRenderer();

  constructor(
    private readonly containerEl: HTMLElement,
    private readonly config: PmTasksConfig,
    private readonly services: TaskProcessorServices,
    private readonly sortService: ITaskSortService,
    private readonly renderer: TaskListRenderer,
    private readonly entityQuery: IEntityQuery<DataviewTask>,
    private readonly savedFilters?: SavedDashboardFilters | null,
    private readonly onSaveFilters?: ((filters: SavedDashboardFilters | null) => void) | null
  ) {}

  render(): void {
    this.services.loggerService.debug(`pm-tasks-dashboard rendering, mode: "${this.config.mode}"`, LOG_CONTEXT.TASKS_DASHBOARD);
    this.initFilters();
    const root = this.containerEl.createDiv({ cls: CSS_CLS.TASKS_DASHBOARD });
    this.renderControls(root);
    this.outputEl = root.createDiv({ cls: CSS_CLS.TASKS_DASHBOARD_OUTPUT });
    void this.refreshDashboardOutput(this.outputEl);
  }

  refreshOutput(): void {
    if (this.outputEl) void this.refreshDashboardOutput(this.outputEl);
  }

  // ─── Filter initialisation ────────────────────────────────────────────────

  private initFilters(): void {
    const cfg = this.config;
    const saved = this.savedFilters;

    // Resolve sortBy (string shorthand or array) → SortKey[]
    const rawSortBy = saved?.sortBy ?? cfg.sortBy;
    const sortBy: SortKey[] = resolveSortBy(rawSortBy as unknown);

    // Backward-compat migration: legacy saved state may be a string, an old
    // object with mode/presets fields, the old rangeFrom/rangeTo/includeNoDate shape,
    // or the new selectedPresets shape.
    const rawDueDate = saved?.dueDateFilter as unknown;
    let dueDateFilter: DueDateFilter;

    if (typeof rawDueDate === "string") {
      // Shape A: legacy string format — "No Date", known preset, or unknown
      const validPresets: DueDatePreset[] = ["Today", "Tomorrow", "This Week", "Next Week", "Overdue"];
      if (rawDueDate === "No Date") {
        dueDateFilter = { selectedPresets: ["No Date"], rangeFrom: null, rangeTo: null };
      } else if (validPresets.includes(rawDueDate as DueDatePreset)) {
        dueDateFilter = { selectedPresets: [rawDueDate as DueDatePreset], rangeFrom: null, rangeTo: null };
      } else {
        dueDateFilter = { ...DEFAULT_DUE_DATE_FILTER };
      }
    } else if (rawDueDate !== null && typeof rawDueDate === "object" && "mode" in rawDueDate) {
      // Shape B: legacy object format with mode/presets fields
      const legacy = rawDueDate as Record<string, unknown>;
      if (legacy["mode"] === "range") {
        dueDateFilter = {
          selectedPresets: [],
          rangeFrom: (legacy["rangeFrom"] as string | null) ?? null,
          rangeTo: (legacy["rangeTo"] as string | null) ?? null,
        };
      } else if (legacy["mode"] === "presets") {
        dueDateFilter = {
          selectedPresets: Array.isArray(legacy["presets"]) ? (legacy["presets"] as DueDatePreset[]) : [],
          rangeFrom: null,
          rangeTo: null,
        };
      } else {
        dueDateFilter = { ...DEFAULT_DUE_DATE_FILTER };
      }
    } else if (
      rawDueDate !== null &&
      typeof rawDueDate === "object" &&
      "includeNoDate" in rawDueDate &&
      !("selectedPresets" in rawDueDate)
    ) {
      // Shape C: old format with includeNoDate (no selectedPresets yet)
      const old = rawDueDate as Record<string, unknown>;
      const rangeFromRaw = (old["rangeFrom"] as string | null) ?? null;
      const rangeToRaw = (old["rangeTo"] as string | null) ?? null;
      const includeNoDate = Boolean(old["includeNoDate"]);
      const selectedPresets: DueDatePreset[] = [];

      if (includeNoDate) selectedPresets.push("No Date");

      // Check if rangeFrom/rangeTo match a known preset — if so, convert to preset
      let resolvedRangeFrom = rangeFromRaw;
      let resolvedRangeTo = rangeToRaw;
      if (rangeFromRaw !== null || rangeToRaw !== null) {
        const rangePresets: Exclude<DueDatePreset, "No Date">[] = ["Today", "Tomorrow", "This Week", "Next Week", "Overdue"];
        for (const p of rangePresets) {
          const r = presetToDateRange(p);
          if (r.rangeFrom === rangeFromRaw && r.rangeTo === rangeToRaw) {
            selectedPresets.push(p);
            resolvedRangeFrom = null;
            resolvedRangeTo = null;
            break;
          }
        }
      }

      dueDateFilter = { selectedPresets, rangeFrom: resolvedRangeFrom, rangeTo: resolvedRangeTo };
    } else if (
      rawDueDate !== null &&
      typeof rawDueDate === "object" &&
      "selectedPresets" in rawDueDate
    ) {
      // Shape D: current format — use directly
      const current = rawDueDate as DueDateFilter;
      dueDateFilter = { selectedPresets: current.selectedPresets, rangeFrom: current.rangeFrom, rangeTo: current.rangeTo };
    } else {
      // No saved filter; fall back to config default or the empty default
      dueDateFilter = cfg.dueDateFilter ? { ...cfg.dueDateFilter } : { ...DEFAULT_DUE_DATE_FILTER };
    }

    this.filters = {
      viewMode: saved?.viewMode ?? cfg.viewMode ?? this.services.settings.ui.defaultTaskViewMode,
      sortBy,
      showCompleted: saved?.showCompleted ?? cfg.showCompleted ?? this.services.settings.ui.showCompletedByDefault,
      contextFilter: saved?.contextFilter ?? cfg.contextFilter ?? [],
      dueDateFilter,
      // No legacy shapes for these keys — absent saved value ⇒ inactive filter.
      startDateFilter: saved?.startDateFilter ?? cfg.startDateFilter ?? DEFAULT_START_DATE_FILTER,
      scheduledDateFilter: saved?.scheduledDateFilter ?? cfg.scheduledDateFilter ?? DEFAULT_SCHEDULED_DATE_FILTER,
      priorityFilter: saved?.priorityFilter ?? cfg.priorityFilter ?? [],
      projectStatusFilter: saved?.projectStatusFilter ?? cfg.projectStatusFilter ?? [],
      // Backward-compat: "Inactive" was the saved value before the filter was renamed to "Complete".
      inboxStatusFilter: ((saved?.inboxStatusFilter as unknown) === "Inactive" ? "Complete" : saved?.inboxStatusFilter) ?? cfg.inboxStatusFilter ?? "All",
      meetingDateFilter: saved?.meetingDateFilter ?? cfg.meetingDateFilter ?? "All",
      clientFilter: saved?.clientFilter ?? [],
      engagementFilter: saved?.engagementFilter ?? [],
      includeUnassignedClients: saved?.includeUnassignedClients ?? false,
      includeUnassignedEngagements: saved?.includeUnassignedEngagements ?? false,
      tagFilter: saved?.tagFilter ?? cfg.tagFilter ?? [],
      includeUntagged: saved?.includeUntagged ?? cfg.includeUntagged ?? false,
      searchText: "",
    };

    // Migration: if a saved contextFilter includes 'Meeting' but not 'Recurring Meeting',
    // append 'Recurring Meeting' so existing saved filters continue to capture all meeting tasks.
    if (
      this.filters.contextFilter.includes(CONTEXT.MEETING) &&
      !this.filters.contextFilter.includes(CONTEXT.RECURRING_MEETING)
    ) {
      this.filters.contextFilter = [...this.filters.contextFilter, CONTEXT.RECURRING_MEETING];
    }
  }

  // ─── Controls rendering ───────────────────────────────────────────────────

  private renderControls(root: HTMLElement): void {
    const f = this.filters;
    const onChange = () => {
      this.updateChipsBar();
      this.updateFiltersBadge();
      this.persistFilters();
      this.debouncedRefresh(root);
    };

    // === TOOLBAR ===
    const toolbar = root.createDiv({ cls: "pm-tasks-toolbar" });

    // View mode tabs
    const tabsEl = toolbar.createDiv({ cls: "pm-tasks-toolbar__view-tabs" });
    const viewModes: Array<{ value: typeof f.viewMode; label: string }> = [
      { value: VIEW_MODE.CONTEXT, label: "Context" },
      { value: VIEW_MODE.DATE, label: "Date" },
      { value: VIEW_MODE.PRIORITY, label: "Priority" },
      { value: VIEW_MODE.TAG, label: "Tag" },
    ];
    for (const { value, label } of viewModes) {
      const tab = tabsEl.createEl("button", {
        cls: value === f.viewMode ? "pm-tasks-toolbar__tab pm-tasks-toolbar__tab--active" : "pm-tasks-toolbar__tab",
        text: label,
      });
      tab.addEventListener("click", () => {
        f.viewMode = value;
        tabsEl.querySelectorAll(".pm-tasks-toolbar__tab").forEach((t) => {
          t.classList.toggle("pm-tasks-toolbar__tab--active", t === tab);
        });
        this.persistFilters();
        this.debouncedRefresh(root);
      });
    }

    // Search input (flex-grows)
    const searchInput = toolbar.createEl("input", {
      type: "text",
      placeholder: "Search tasks…",
      cls: "pm-tasks-toolbar__search",
    });
    searchInput.setAttribute("aria-label", "Search tasks");
    searchInput.value = f.searchText;
    searchInput.addEventListener("input", () => {
      f.searchText = searchInput.value.toLowerCase();
      this.debouncedRefresh(root);
    });

    // Filters button
    this.filtersBtnEl = toolbar.createEl("button", {
      cls: "pm-tasks-toolbar__filters-btn",
    });
    this.filtersBtnEl.createSpan({ text: "⚙ Filters " });
    this.filtersBadgeEl = this.filtersBtnEl.createSpan({ cls: "pm-tasks-filter-badge" });
    this.filtersBtnEl.addEventListener("click", () => {
      this.isDrawerOpen = !this.isDrawerOpen;
      if (this.drawerEl) {
        this.drawerEl.style.display = this.isDrawerOpen ? "" : "none";
      }
    });

    // === CHIPS BAR (placeholder — filled by updateChipsBar) ===
    this.chipsBarEl = root.createDiv({ cls: CSS_CLS.TASKS_CHIPS_BAR });
    this.chipsBarEl.style.display = "none";

    // === DRAWER ===
    this.drawerEl = root.createDiv({ cls: "pm-tasks-drawer" });
    this.drawerEl.style.display = this.isDrawerOpen ? "" : "none";
    this.renderDrawer(this.drawerEl, f, onChange, root);

    // Initial badge and chips update
    this.updateFiltersBadge();
    this.updateChipsBar();
  }

  // ─── Drawer rendering ─────────────────────────────────────────────────────

  private renderDrawer(drawerEl: HTMLElement, f: DashboardFilters, onChange: () => void, root: HTMLElement): void {
    // Sort Order section
    const sortSection = drawerEl.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION });
    sortSection.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION_LABEL, text: TASK_DRAWER_TEXT.SORT_ORDER_LABEL });
    const sortContainer = sortSection.createDiv();
    const sortBuilder = new SortKeyBuilder(sortContainer, {
      keys: [...f.sortBy],
      onChange: (keys) => { f.sortBy = keys; onChange(); },
    });
    this.drawerComponents.push(sortBuilder);
    this.chipSelects = []; // reset — chipSelects are a subset of drawerComponents

    drawerEl.createEl(HTML_TAG.HR, { cls: CSS_CLS.TASKS_DRAWER_DIVIDER });

    // Completed + Due Date (2-col grid)
    const completedDueGrid = drawerEl.createDiv({ cls: CSS_CLS.TASKS_DRAWER_GRID });

    // Completed (left)
    const completedSection = completedDueGrid.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION });
    completedSection.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION_LABEL, text: TASK_DRAWER_TEXT.COMPLETED_TASKS_LABEL });
    const completedToggle = completedSection.createDiv({ cls: "pm-tasks-toggle-row" });
    const track = completedToggle.createDiv({
      cls: f.showCompleted ? "pm-tasks-toggle-track pm-tasks-toggle-track--on" : "pm-tasks-toggle-track",
    });
    track.createDiv({ cls: "pm-tasks-toggle-thumb" });
    completedToggle.createSpan({ text: "Show completed" });
    completedToggle.addEventListener("click", () => {
      f.showCompleted = !f.showCompleted;
      track.classList.toggle("pm-tasks-toggle-track--on", f.showCompleted);
      onChange();
    });

    // Due Date (right)
    const dueDateSection = completedDueGrid.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION });
    dueDateSection.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION_LABEL, text: TASK_DRAWER_TEXT.DUE_DATE_LABEL });
    this.renderDrawerDueDateSection(dueDateSection, f, onChange);

    drawerEl.createEl(HTML_TAG.HR, { cls: CSS_CLS.TASKS_DRAWER_DIVIDER });

    // Start Date + Scheduled Date (2-col grid)
    const startSchedGrid = drawerEl.createDiv({ cls: CSS_CLS.TASKS_DRAWER_GRID });

    const startDateSection = startSchedGrid.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION });
    startDateSection.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION_LABEL, text: TASK_DRAWER_TEXT.START_DATE_LABEL });
    this.renderRangeDateSection(startDateSection, {
      getFilter: () => f.startDateFilter,
      setFilter: (next) => { f.startDateFilter = next as StartDateFilter; },
      noDatePreset: START_DATE_PRESET.NO_DATE,
      fromAria: TASK_DRAWER_TEXT.START_RANGE_FROM_ARIA,
      toAria: TASK_DRAWER_TEXT.START_RANGE_TO_ARIA,
      onChange,
    });

    const scheduledDateSection = startSchedGrid.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION });
    scheduledDateSection.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION_LABEL, text: TASK_DRAWER_TEXT.SCHEDULED_DATE_LABEL });
    this.renderRangeDateSection(scheduledDateSection, {
      getFilter: () => f.scheduledDateFilter,
      setFilter: (next) => { f.scheduledDateFilter = next as ScheduledDateFilter; },
      noDatePreset: SCHEDULED_DATE_PRESET.NO_DATE,
      fromAria: TASK_DRAWER_TEXT.SCHEDULED_RANGE_FROM_ARIA,
      toAria: TASK_DRAWER_TEXT.SCHEDULED_RANGE_TO_ARIA,
      onChange,
    });

    drawerEl.createEl(HTML_TAG.HR, { cls: CSS_CLS.TASKS_DRAWER_DIVIDER });

    // Priority + Context (2-col grid)
    const priCtxGrid = drawerEl.createDiv({ cls: CSS_CLS.TASKS_DRAWER_GRID });
    const prioritySection = priCtxGrid.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION });
    prioritySection.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION_LABEL, text: TASK_DRAWER_TEXT.PRIORITY_LABEL });
    this.renderPillGroup(prioritySection,
      TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_PILL_LABEL[p] })),
      f.priorityFilter, (val) => {
      const v = val as TaskPriority;
      if (f.priorityFilter.includes(v)) f.priorityFilter = f.priorityFilter.filter((p) => p !== v);
      else f.priorityFilter = [...f.priorityFilter, v];
      onChange();
    });

    const contextSection = priCtxGrid.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION });
    contextSection.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION_LABEL, text: TASK_DRAWER_TEXT.CONTEXT_TYPE_LABEL });
    this.renderPillGroup(contextSection, TASK_CONTEXTS.map((c) => ({ value: c, label: c })),
      f.contextFilter, (val) => {
        const v = val as TaskContext;
        if (f.contextFilter.includes(v)) f.contextFilter = f.contextFilter.filter((c) => c !== v);
        else f.contextFilter = [...f.contextFilter, v];
        onChange();
      });

    drawerEl.createEl(HTML_TAG.HR, { cls: CSS_CLS.TASKS_DRAWER_DIVIDER });

    // Client + Engagement (2-col grid)
    const clientEngGrid = drawerEl.createDiv({ cls: CSS_CLS.TASKS_DRAWER_GRID });
    const clientSection = clientEngGrid.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION });
    clientSection.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION_LABEL, text: TASK_DRAWER_TEXT.CLIENT_LABEL });
    const activeClients = this.services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.client);
    const clientChipSelect = new FilterChipSelect(clientSection, this.services.app, {
      options: activeClients.map((p) => ({ value: p.file.name, displayText: p.file.name })),
      selectedValues: [...f.clientFilter],
      placeholder: "type…",
      ariaLabel: "Filter by client",
      includeUnassigned: f.includeUnassignedClients,
      unassignedLabel: "Include unassigned",
      onChange: (values, incl) => { f.clientFilter = values; f.includeUnassignedClients = incl; onChange(); },
    });
    this.chipSelects.push(clientChipSelect);
    this.drawerComponents.push(clientChipSelect);

    const engSection = clientEngGrid.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION });
    engSection.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION_LABEL, text: TASK_DRAWER_TEXT.ENGAGEMENT_LABEL });
    const activeEngagements = this.services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.engagement);
    const engChipSelect = new FilterChipSelect(engSection, this.services.app, {
      options: activeEngagements.map((p) => ({ value: p.file.name, displayText: p.file.name })),
      selectedValues: [...f.engagementFilter],
      placeholder: "type…",
      ariaLabel: "Filter by engagement",
      includeUnassigned: f.includeUnassignedEngagements,
      unassignedLabel: "Include unassigned",
      onChange: (values, incl) => { f.engagementFilter = values; f.includeUnassignedEngagements = incl; onChange(); },
    });
    this.chipSelects.push(engChipSelect);
    this.drawerComponents.push(engChipSelect);

    drawerEl.createEl(HTML_TAG.HR, { cls: CSS_CLS.TASKS_DRAWER_DIVIDER });

    // Context-specific filters
    const ctxSpecSection = drawerEl.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION });
    ctxSpecSection.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION_LABEL, text: TASK_DRAWER_TEXT.CONTEXT_SPECIFIC_LABEL });
    const ctxSpecGrid = ctxSpecSection.createDiv({ cls: CSS_CLS.TASKS_DRAWER_GRID });

    const projStatusSection = ctxSpecGrid.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION });
    projStatusSection.createSpan({ text: TASK_DRAWER_TEXT.PROJECT_STATUS_LABEL, cls: CSS_CLS.TASKS_DRAWER_SECTION_LABEL });
    this.renderPillGroup(projStatusSection, (["New", "Active", "On Hold", "Complete"] as ProjectStatus[]).map((s) => ({ value: s, label: s })),
      f.projectStatusFilter, (val) => {
        const v = val as ProjectStatus;
        if (f.projectStatusFilter.includes(v)) f.projectStatusFilter = f.projectStatusFilter.filter((s) => s !== v);
        else f.projectStatusFilter = [...f.projectStatusFilter, v];
        onChange();
      });

    const inboxStatusSection = ctxSpecGrid.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION });
    inboxStatusSection.createSpan({ text: TASK_DRAWER_TEXT.INBOX_STATUS_LABEL, cls: CSS_CLS.TASKS_DRAWER_SECTION_LABEL });
    this.renderPillGroup(inboxStatusSection, (["All", "Active", "Complete"] as InboxStatusFilter[]).map((s) => ({ value: s, label: s })),
      [f.inboxStatusFilter], (val) => {
        f.inboxStatusFilter = val as InboxStatusFilter;
        onChange();
      }, true /* single select */);

    const meetingDateSection = ctxSpecGrid.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION });
    meetingDateSection.createSpan({ text: TASK_DRAWER_TEXT.MEETING_DATE_LABEL, cls: CSS_CLS.TASKS_DRAWER_SECTION_LABEL });
    this.renderPillGroup(meetingDateSection, (["All", "Today", "This Week", "Past"] as MeetingDateFilter[]).map((s) => ({ value: s, label: s })),
      [f.meetingDateFilter], (val) => {
        f.meetingDateFilter = val as MeetingDateFilter;
        onChange();
      }, true /* single select */);

    drawerEl.createEl(HTML_TAG.HR, { cls: CSS_CLS.TASKS_DRAWER_DIVIDER });

    // Tags
    this.renderTagFilterSection(drawerEl, f, onChange);

    // Clear Filters button at bottom of drawer
    const clearBtnRow = drawerEl.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION });
    clearBtnRow.createEl("button", { text: "✕ Clear All Filters", cls: "pm-tasks-toolbar__clear-btn" })
      .addEventListener("click", () => {
        this.onSaveFilters?.(null);
        this.destroyDrawerComponents();
        this.isDrawerOpen = false;
        // Re-render entire dashboard from scratch
        const dashboard = root.closest(`.${CSS_CLS.TASKS_DASHBOARD}`) ?? root;
        dashboard.empty();
        this.initFilters();
        this.renderControls(dashboard as HTMLElement);
        this.outputEl = (dashboard as HTMLElement).createDiv({ cls: CSS_CLS.TASKS_DASHBOARD_OUTPUT });
        void this.refreshDashboardOutput(this.outputEl);
      });
  }

  /** Renders the drawer's tag filter: a labelled section with a chip-select over every task tag. */
  private renderTagFilterSection(drawerEl: HTMLElement, f: DashboardFilters, onChange: () => void): void {
    const tagsSection = drawerEl.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION });
    tagsSection.createDiv({ cls: CSS_CLS.TASKS_DRAWER_SECTION_LABEL, text: TASK_DRAWER_TEXT.TAGS_LABEL });
    const allTags = [...new Set(this.entityQuery.resolve().flatMap((t) => t.tags ?? []))].sort();
    if (allTags.length === 0) return;
    const tagChipSelect = new FilterChipSelect(tagsSection, this.services.app, {
      options: allTags.map((tag) => ({ value: tag, displayText: tag })),
      selectedValues: [...f.tagFilter],
      placeholder: TASK_DRAWER_TEXT.TAG_FILTER_PLACEHOLDER,
      ariaLabel: TASK_DRAWER_TEXT.TAG_FILTER_ARIA,
      includeUnassigned: f.includeUntagged,
      unassignedLabel: TASK_DRAWER_TEXT.INCLUDE_UNTAGGED_LABEL,
      onChange: (values, incl) => { f.tagFilter = values; f.includeUntagged = incl; onChange(); },
    });
    this.chipSelects.push(tagChipSelect);
    this.drawerComponents.push(tagChipSelect);
  }

  /** Composes the pill CSS class for a due-date preset given its active/warn state. */
  private static pillClass(isActive: boolean, isWarn: boolean): string {
    if (!isActive) return CSS_CLS.TASKS_PILL;
    return `${CSS_CLS.TASKS_PILL} ${isWarn ? CSS_CLS.TASKS_PILL_WARN : CSS_CLS.TASKS_PILL_ACTIVE}`;
  }

  private renderDrawerDueDateSection(container: HTMLElement, f: DashboardFilters, onChange: () => void): void {
    // Preset pills
    const pillGroup = container.createDiv({ cls: CSS_CLS.TASKS_PILL_GROUP });
    const presets: DueDatePreset[] = [...DUE_DATE_PRESETS];
    for (const preset of presets) {
      const isOverdue = preset === DUE_DATE_PRESET.OVERDUE;
      const isActive = f.dueDateFilter.selectedPresets.includes(preset);
      const pill = pillGroup.createEl(HTML_TAG.BUTTON, {
        cls: DashboardView.pillClass(isActive, isOverdue),
        text: preset,
      });
      pill.addEventListener(DOM_EVENT.CLICK, () => {
        const currentPresets = f.dueDateFilter.selectedPresets;
        if (currentPresets.includes(preset)) {
          f.dueDateFilter = { ...f.dueDateFilter, selectedPresets: currentPresets.filter((p) => p !== preset) };
        } else {
          // Adding a preset clears the custom range
          f.dueDateFilter = { selectedPresets: [...currentPresets, preset], rangeFrom: null, rangeTo: null };
          fromInput.value = "";
          toInput.value = "";
        }
        pill.className = DashboardView.pillClass(f.dueDateFilter.selectedPresets.includes(preset), isOverdue);
        onChange();
      });
    }

    // Custom range
    const rangeRow = container.createDiv({ cls: CSS_CLS.TASKS_DATE_RANGE });
    rangeRow.createSpan({ text: TASK_DRAWER_TEXT.RANGE_FROM_LABEL });
    const fromInput = rangeRow.createEl(HTML_TAG.INPUT, { type: INPUT_TYPE.DATE, cls: CSS_CLS.TASKS_DATE_RANGE_INPUT });
    fromInput.value = f.dueDateFilter.rangeFrom ?? "";
    fromInput.setAttribute(DOM_ATTR.ARIA_LABEL, TASK_DRAWER_TEXT.DUE_RANGE_FROM_ARIA);
    rangeRow.createSpan({ text: TASK_DRAWER_TEXT.RANGE_SEPARATOR });
    const toInput = rangeRow.createEl(HTML_TAG.INPUT, { type: INPUT_TYPE.DATE, cls: CSS_CLS.TASKS_DATE_RANGE_INPUT });
    toInput.value = f.dueDateFilter.rangeTo ?? "";
    toInput.setAttribute(DOM_ATTR.ARIA_LABEL, TASK_DRAWER_TEXT.DUE_RANGE_TO_ARIA);

    fromInput.addEventListener(DOM_EVENT.CHANGE, () => {
      f.dueDateFilter = {
        selectedPresets: [],
        rangeFrom: fromInput.value || null,
        rangeTo: f.dueDateFilter.rangeTo,
      };
      onChange();
    });
    toInput.addEventListener(DOM_EVENT.CHANGE, () => {
      f.dueDateFilter = {
        selectedPresets: [],
        rangeFrom: f.dueDateFilter.rangeFrom,
        rangeTo: toInput.value || null,
      };
      onChange();
    });
  }

  /**
   * Renders a start/scheduled-style date filter section: a single no-date preset
   * pill plus an inclusive From/To custom range. The no-date pill and the range
   * are mutually exclusive — entering a range clears the pill and vice-versa.
   */
  private renderRangeDateSection(
    container: HTMLElement,
    opts: {
      getFilter: () => RangeDateFilterView;
      setFilter: (next: RangeDateFilterView) => void;
      noDatePreset: string;
      fromAria: string;
      toAria: string;
      onChange: () => void;
    }
  ): void {
    const { getFilter, setFilter, noDatePreset, fromAria, toAria, onChange } = opts;
    const initial = getFilter();

    const isNoDateActive = (): boolean => getFilter().selectedPresets.includes(noDatePreset);
    const syncPill = (): void => {
      pill.className = DashboardView.pillClass(isNoDateActive(), false);
    };

    const pillGroup = container.createDiv({ cls: CSS_CLS.TASKS_PILL_GROUP });
    const pill = pillGroup.createEl(HTML_TAG.BUTTON, {
      cls: DashboardView.pillClass(initial.selectedPresets.includes(noDatePreset), false),
      text: noDatePreset,
    });
    pill.addEventListener(DOM_EVENT.CLICK, () => {
      if (isNoDateActive()) {
        setFilter({ selectedPresets: [], rangeFrom: null, rangeTo: null });
      } else {
        // Enabling the no-date preset clears any custom range.
        setFilter({ selectedPresets: [noDatePreset], rangeFrom: null, rangeTo: null });
        fromInput.value = "";
        toInput.value = "";
      }
      syncPill();
      onChange();
    });

    const rangeRow = container.createDiv({ cls: CSS_CLS.TASKS_DATE_RANGE });
    rangeRow.createSpan({ text: TASK_DRAWER_TEXT.RANGE_FROM_LABEL });
    const fromInput = rangeRow.createEl(HTML_TAG.INPUT, { type: INPUT_TYPE.DATE, cls: CSS_CLS.TASKS_DATE_RANGE_INPUT });
    fromInput.value = initial.rangeFrom ?? "";
    fromInput.setAttribute(DOM_ATTR.ARIA_LABEL, fromAria);
    rangeRow.createSpan({ text: TASK_DRAWER_TEXT.RANGE_SEPARATOR });
    const toInput = rangeRow.createEl(HTML_TAG.INPUT, { type: INPUT_TYPE.DATE, cls: CSS_CLS.TASKS_DATE_RANGE_INPUT });
    toInput.value = initial.rangeTo ?? "";
    toInput.setAttribute(DOM_ATTR.ARIA_LABEL, toAria);

    // Entering either range bound clears the no-date preset (mutually exclusive).
    fromInput.addEventListener(DOM_EVENT.CHANGE, () => {
      setFilter({ selectedPresets: [], rangeFrom: fromInput.value || null, rangeTo: getFilter().rangeTo });
      syncPill();
      onChange();
    });
    toInput.addEventListener(DOM_EVENT.CHANGE, () => {
      setFilter({ selectedPresets: [], rangeFrom: getFilter().rangeFrom, rangeTo: toInput.value || null });
      syncPill();
      onChange();
    });
  }

  private renderPillGroup(
    container: HTMLElement,
    options: Array<{ value: string | number; label: string }>,
    activeValues: Array<string | number>,
    onToggle: (value: string | number) => void,
    singleSelect = false
  ): void {
    const group = container.createDiv({ cls: "pm-tasks-pill-group" });
    for (const opt of options) {
      const isActive = activeValues.includes(opt.value);
      const pill = group.createEl("button", {
        cls: isActive ? "pm-tasks-pill pm-tasks-pill--active" : "pm-tasks-pill",
        text: String(opt.label),
      });
      pill.addEventListener("click", () => {
        onToggle(opt.value);
        if (singleSelect) {
          group.querySelectorAll(".pm-tasks-pill").forEach((p, i) => {
            p.className = options[i].value === opt.value ? "pm-tasks-pill pm-tasks-pill--active" : "pm-tasks-pill";
          });
        } else {
          pill.classList.toggle("pm-tasks-pill--active");
        }
      });
    }
  }

  // ─── Chips bar ────────────────────────────────────────────────────────────

  private updateChipsBar(): void {
    if (!this.chipsBarEl) return;
    this.chipsBarEl.empty();
    const chips = this.getActiveChips();
    if (chips.length === 0) {
      this.chipsBarEl.style.display = "none";
      return;
    }
    this.chipsBarEl.style.display = "";
    const label = this.chipsBarEl.createSpan();
    label.style.cssText = "font-size:var(--font-smaller);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;";
    label.textContent = TASK_DRAWER_TEXT.CHIPS_LABEL;
    for (const { label: chipLabel, onRemove } of chips) {
      const chip = this.chipsBarEl.createSpan({ cls: CSS_CLS.TASKS_FILTER_CHIP });
      chip.createSpan({ text: chipLabel });
      const removeBtn = chip.createSpan({ cls: CSS_CLS.TASKS_FILTER_CHIP_REMOVE, text: TASK_DRAWER_TEXT.CHIP_REMOVE });
      removeBtn.addEventListener(DOM_EVENT.CLICK, () => { onRemove(); });
    }
  }

  private getActiveChips(): Array<{ label: string; onRemove: () => void }> {
    const f = this.filters;
    const chips: Array<{ label: string; onRemove: () => void }> = [];
    const rerender = () => {
      this.updateChipsBar();
      this.updateFiltersBadge();
      this.persistFilters();
      if (this.outputEl) void this.refreshDashboardOutput(this.outputEl);
    };

    for (const preset of f.dueDateFilter.selectedPresets) {
      chips.push({ label: TASK_DRAWER_TEXT.dueDateChip(preset), onRemove: () => {
        f.dueDateFilter = { ...f.dueDateFilter, selectedPresets: f.dueDateFilter.selectedPresets.filter((p) => p !== preset) };
        rerender();
      }});
    }
    if (f.dueDateFilter.rangeFrom || f.dueDateFilter.rangeTo) {
      chips.push({ label: TASK_DRAWER_TEXT.dueDateChip(TASK_DRAWER_TEXT.rangeLabel(f.dueDateFilter.rangeFrom, f.dueDateFilter.rangeTo)), onRemove: () => {
        f.dueDateFilter = { ...f.dueDateFilter, rangeFrom: null, rangeTo: null };
        rerender();
      }});
    }
    for (const preset of f.startDateFilter.selectedPresets) {
      chips.push({ label: TASK_DRAWER_TEXT.startDateChip(preset), onRemove: () => {
        f.startDateFilter = { ...f.startDateFilter, selectedPresets: f.startDateFilter.selectedPresets.filter((p) => p !== preset) };
        rerender();
      }});
    }
    if (f.startDateFilter.rangeFrom || f.startDateFilter.rangeTo) {
      chips.push({ label: TASK_DRAWER_TEXT.startDateChip(TASK_DRAWER_TEXT.rangeLabel(f.startDateFilter.rangeFrom, f.startDateFilter.rangeTo)), onRemove: () => {
        f.startDateFilter = { ...f.startDateFilter, rangeFrom: null, rangeTo: null };
        rerender();
      }});
    }
    for (const preset of f.scheduledDateFilter.selectedPresets) {
      chips.push({ label: TASK_DRAWER_TEXT.scheduledDateChip(preset), onRemove: () => {
        f.scheduledDateFilter = { ...f.scheduledDateFilter, selectedPresets: f.scheduledDateFilter.selectedPresets.filter((p) => p !== preset) };
        rerender();
      }});
    }
    if (f.scheduledDateFilter.rangeFrom || f.scheduledDateFilter.rangeTo) {
      chips.push({ label: TASK_DRAWER_TEXT.scheduledDateChip(TASK_DRAWER_TEXT.rangeLabel(f.scheduledDateFilter.rangeFrom, f.scheduledDateFilter.rangeTo)), onRemove: () => {
        f.scheduledDateFilter = { ...f.scheduledDateFilter, rangeFrom: null, rangeTo: null };
        rerender();
      }});
    }
    for (const p of f.priorityFilter) {
      chips.push({ label: TASK_DRAWER_TEXT.priorityChip(TASK_PRIORITY_PILL_LABEL[p] ?? String(p)), onRemove: () => {
        f.priorityFilter = f.priorityFilter.filter((v) => v !== p);
        rerender();
      }});
    }
    for (const ctx of f.contextFilter) {
      chips.push({ label: TASK_DRAWER_TEXT.contextChip(ctx), onRemove: () => {
        f.contextFilter = f.contextFilter.filter((c) => c !== ctx);
        rerender();
      }});
    }
    for (const client of f.clientFilter) {
      chips.push({ label: TASK_DRAWER_TEXT.clientChip(client), onRemove: () => {
        f.clientFilter = f.clientFilter.filter((c) => c !== client);
        rerender();
      }});
    }
    for (const eng of f.engagementFilter) {
      chips.push({ label: TASK_DRAWER_TEXT.engagementChip(eng), onRemove: () => {
        f.engagementFilter = f.engagementFilter.filter((e) => e !== eng);
        rerender();
      }});
    }
    for (const tag of f.tagFilter) {
      chips.push({ label: TASK_DRAWER_TEXT.tagChip(tag), onRemove: () => {
        f.tagFilter = f.tagFilter.filter((t) => t !== tag);
        rerender();
      }});
    }
    if (f.showCompleted) {
      chips.push({ label: TASK_DRAWER_TEXT.COMPLETED_CHIP, onRemove: () => { f.showCompleted = false; rerender(); }});
    }
    return chips;
  }

  // ─── Filters badge ────────────────────────────────────────────────────────

  private updateFiltersBadge(): void {
    if (!this.filtersBtnEl || !this.filtersBadgeEl) return;
    const count = this.getActiveFilterCount();
    this.filtersBadgeEl.textContent = count > 0 ? String(count) : "";
    this.filtersBadgeEl.style.display = count > 0 ? "" : "none";
    this.filtersBtnEl.classList.toggle("pm-tasks-toolbar__filters-btn--active", count > 0);
  }

  private getActiveFilterCount(): number {
    const f = this.filters;
    let count = 0;
    if (f.sortBy.length > 0) count++;
    if (f.showCompleted) count++;
    if (isDueDateFilterActive(f.dueDateFilter)) count++;
    if (isStartDateFilterActive(f.startDateFilter)) count++;
    if (isScheduledDateFilterActive(f.scheduledDateFilter)) count++;
    if (f.priorityFilter.length > 0) count++;
    if (f.contextFilter.length > 0) count++;
    if (f.clientFilter.length > 0 || f.includeUnassignedClients) count++;
    if (f.engagementFilter.length > 0 || f.includeUnassignedEngagements) count++;
    if (f.projectStatusFilter.length > 0) count++;
    if (f.inboxStatusFilter !== INBOX_STATUS_FILTER.ALL) count++;
    if (f.meetingDateFilter !== MEETING_DATE_FILTER.ALL) count++;
    if (f.tagFilter.length > 0 || f.includeUntagged) count++;
    return count;
  }

  // ─── Drawer component cleanup ─────────────────────────────────────────────

  private destroyDrawerComponents(): void {
    for (const c of this.drawerComponents) c.destroy();
    this.drawerComponents = [];
    this.chipSelects = [];
  }

  // ─── Output rendering ─────────────────────────────────────────────────────

  private async refreshDashboardOutput(outputEl: HTMLElement): Promise<void> {
    const dv = this.services.queryService.dv();
    if (!dv) {
      outputEl.empty();
      outputEl.createEl(HTML_TAG.EM, { text: MSG.DATAVIEW_UNAVAILABLE });
      return;
    }

    try {
      await this.buildShell(outputEl, dv).render(outputEl);
    } catch (err) {
      this.services.loggerService.error(String(err), LOG_CONTEXT.TASKS_DASHBOARD, err);
      outputEl.empty();
      renderError(outputEl, TASK_DASHBOARD_MSG.ERROR(String(err)));
    }
  }

  /**
   * Assembles the generic {@link DashboardShell} from this view's existing
   * collaborators: the task query, the four view renderers, the task
   * spec/state builders that drive the `FilterEngine`, and the precomputed
   * render helpers. The shell owns only the data-flow; all filter UI,
   * persistence, and teardown stay on this view.
   */
  private buildShell(
    outputEl: HTMLElement,
    dv: DataviewApi
  ): DashboardShell<DataviewTask, TaskRenderHelpers> {
    const deps: DashboardShellDeps<DataviewTask, TaskRenderHelpers> = {
      query: this.entityQuery,
      views: {
        [VIEW_MODE.CONTEXT]: this.contextRenderer,
        [VIEW_MODE.DATE]: this.dateRenderer,
        [VIEW_MODE.PRIORITY]: this.priorityRenderer,
        [VIEW_MODE.TAG]: this.tagRenderer,
      },
      getViewMode: () => this.filters.viewMode,
      getFilters: () => this.filters,
      buildSpec: () =>
        buildTaskFilterSpec({
          folders: this.services.settings.folders,
          dv,
          hierarchyService: this.services.hierarchyService,
        }),
      buildState: () => buildTaskFilterState(this.filters),
      buildHelpers: (items) => this.buildTaskRenderHelpers(items, dv),
      onFilterChange: (patch) => {
        Object.assign(this.filters, patch);
        this.persistFilters();
        void this.refreshDashboardOutput(outputEl);
      },
      emptyMessage: TASK_DASHBOARD_MSG.NO_TASKS_MATCH,
      onUnknownMode: (el, mode) => renderError(el, TASK_DASHBOARD_MSG.UNKNOWN_VIEW_MODE(mode)),
    };
    return new DashboardShell(deps);
  }

  /**
   * Pre-resolves every Dataview read the read-pure view renderers need into a
   * `TaskRenderHelpers`: the parent-path map (context-appropriate parent per
   * task, with an entry for every task — the path is built from front-matter
   * without an existence check, preserving the lazy semantic) and the
   * display-name map (with the raw path substituted for a missing page).
   */
  private buildTaskRenderHelpers(allTasks: DataviewTask[], dv: DataviewApi): TaskRenderHelpers {
    const folders = this.services.settings.folders;
    // Pre-compute maps for the sort fields the read-pure renderers consume.
    const contextMap = new Map(allTasks.map((t) => [t.path, getTaskContext(t, folders)]));
    const mtimeMap = new Map(allTasks.map((t) => [t.path, dv.page(t.path)?.file.mtime.valueOf() ?? 0]));
    const parentPathMap = new Map<string, string | null>();
    for (const t of allTasks) {
      const taskContext = contextMap.get(t.path);
      let parentPath: string | null = null;
      if (taskContext === CONTEXT.PROJECT) {
        parentPath = getParentProjectPath(t.link.path, dv, folders.projects);
      } else if (taskContext === CONTEXT.RECURRING_MEETING) {
        parentPath = getParentRecurringMeetingPath(t.link.path, dv, folders.meetingsRecurring);
      }
      parentPathMap.set(t.link.path, parentPath);
    }
    const namePaths = new Set<string>();
    for (const t of allTasks) namePaths.add(t.link.path);
    for (const p of parentPathMap.values()) if (p) namePaths.add(p);
    const nameMap = new Map<string, string>();
    for (const p of namePaths) nameMap.set(p, dv.page(p)?.file.name ?? p);

    return {
      sortService: this.sortService,
      taskRenderer: this.renderer,
      contextMap,
      mtimeMap,
      parentPathMap,
      nameMap,
    };
  }

  private persistFilters(): void {
    if (!this.onSaveFilters) return;
    const f = this.filters;
    const toSave: SavedDashboardFilters = {
      viewMode: f.viewMode,
      sortBy: f.sortBy,
      showCompleted: f.showCompleted,
      contextFilter: f.contextFilter,
      dueDateFilter: f.dueDateFilter,
      startDateFilter: f.startDateFilter,
      scheduledDateFilter: f.scheduledDateFilter,
      priorityFilter: f.priorityFilter,
      projectStatusFilter: f.projectStatusFilter,
      inboxStatusFilter: f.inboxStatusFilter,
      meetingDateFilter: f.meetingDateFilter,
      clientFilter: f.clientFilter,
      engagementFilter: f.engagementFilter,
      includeUnassignedClients: f.includeUnassignedClients,
      includeUnassignedEngagements: f.includeUnassignedEngagements,
      tagFilter: f.tagFilter,
      includeUntagged: f.includeUntagged,
    };
    this.onSaveFilters(toSave);
  }

  private debouncedRefresh(controlsEl: HTMLElement): void {
    this.searchControlsEl = controlsEl;
    this.search.trigger();
  }

  private runDebouncedRefresh(): void {
    const controlsEl = this.searchControlsEl;
    if (!controlsEl) return;
    const dashboard = controlsEl.closest(`.${CSS_CLS.TASKS_DASHBOARD}`);
    if (!dashboard) return;
    const outputEl = dashboard.querySelector(`.${CSS_CLS.TASKS_DASHBOARD_OUTPUT}`);
    if (outputEl instanceof HTMLElement) void this.refreshDashboardOutput(outputEl);
  }

  /** Cancels any pending debounced refresh and releases drawer/filter components. */
  destroy(): void {
    this.search.cancel();
    this.destroyDrawerComponents();
  }

}
