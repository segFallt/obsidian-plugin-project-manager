import type { TaskProcessorServices } from "../plugin-context";
import type {
  PmTasksConfig,
  DataviewApi,
  DataviewTask,
  DashboardFilters,
  SavedDashboardFilters,
  DueDateFilter,
  DueDatePreset,
  MeetingDateFilter,
  InboxStatusFilter,
  SortKey,
  SortField,
  SortDirection,
  ProjectStatus,
  TaskContext,
  TaskPriority,
} from "../types";
import { CONTEXT, ENTITY_TAGS, TASK_CONTEXTS, DUE_DATE_PRESETS, DEFAULT_DUE_DATE_FILTER, DEBOUNCE_MS, MSG, LOG_CONTEXT, VIEW_MODE } from "../constants";
import { renderError } from "./dom-helpers";
import type { ITaskFilterService } from "../services/interfaces";
import type { ITaskSortService } from "../services/interfaces";
import { presetToDateRange } from "../utils/date-utils";
import type { TaskListRenderer } from "./task-list-renderer";
import { FilterChipSelect } from "../ui/components/filter-chip-select";
import { SortKeyBuilder } from "../ui/components/sort-key-builder";
import { ContextViewRenderer } from "./dashboard-views/context-view-renderer";
import { DateViewRenderer } from "./dashboard-views/date-view-renderer";
import { PriorityViewRenderer } from "./dashboard-views/priority-view-renderer";
import { TagViewRenderer } from "./dashboard-views/tag-view-renderer";
import { getTaskContext } from "../utils/task-utils";

// ─── Legacy sort migration map ────────────────────────────────────────────────

/** Maps legacy sortBy string values to the current SortKey[] format. */
const LEGACY_SORT_MAP: Record<string, SortKey[]> = {
  "dueDate-asc": [{ field: "dueDate" as SortField, direction: "asc" as SortDirection }],
  "dueDate-desc": [{ field: "dueDate" as SortField, direction: "desc" as SortDirection }],
  "priority-asc": [{ field: "priority" as SortField, direction: "asc" as SortDirection }],
  "priority-desc": [{ field: "priority" as SortField, direction: "desc" as SortDirection }],
};

/**
 * Renders the full dashboard mode: filter controls and all four view renderers
 * (context, date, priority, tag).
 */
export class DashboardView {
  private filters!: DashboardFilters;
  private outputEl!: HTMLElement;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private chipSelects: FilterChipSelect[] = [];
  private isDrawerOpen = false;
  private chipsBarEl: HTMLElement | null = null;
  private drawerEl: HTMLElement | null = null;
  private filtersBtnEl: HTMLButtonElement | null = null;
  private filtersBadgeEl: HTMLElement | null = null;
  private drawerComponents: Array<{ destroy(): void }> = [];
  private readonly contextRenderer: ContextViewRenderer;
  private readonly dateRenderer: DateViewRenderer;
  private readonly priorityRenderer: PriorityViewRenderer;
  private readonly tagRenderer: TagViewRenderer;

  constructor(
    private readonly containerEl: HTMLElement,
    private readonly config: PmTasksConfig,
    private readonly services: TaskProcessorServices,
    private readonly filterService: ITaskFilterService,
    private readonly sortService: ITaskSortService,
    private readonly renderer: TaskListRenderer,
    private readonly savedFilters?: SavedDashboardFilters | null,
    private readonly onSaveFilters?: ((filters: SavedDashboardFilters | null) => void) | null
  ) {
    this.contextRenderer = new ContextViewRenderer(services, sortService, renderer);
    this.dateRenderer = new DateViewRenderer(sortService, renderer);
    this.priorityRenderer = new PriorityViewRenderer(sortService, renderer);
    this.tagRenderer = new TagViewRenderer(sortService, renderer);
  }

  render(): void {
    this.services.loggerService.debug(`pm-tasks-dashboard rendering, mode: "${this.config.mode}"`, LOG_CONTEXT.TASKS_DASHBOARD);
    this.initFilters();
    const root = this.containerEl.createDiv({ cls: "pm-tasks-dashboard" });
    this.renderControls(root);
    this.outputEl = root.createDiv({ cls: "pm-tasks-dashboard__output" });
    void this.refreshDashboardOutput(this.outputEl);
  }

  refreshOutput(): void {
    if (this.outputEl) void this.refreshDashboardOutput(this.outputEl);
  }

  // ─── Filter initialisation ────────────────────────────────────────────────

  private initFilters(): void {
    const cfg = this.config;
    const saved = this.savedFilters;

    // Migrate legacy sortBy string → SortKey[]
    const rawSortBy = saved?.sortBy ?? cfg.sortBy;
    const sortBy: SortKey[] = this.migrateLegacySortBy(rawSortBy as unknown);

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

  private migrateLegacySortBy(raw: unknown): SortKey[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as SortKey[];
    if (typeof raw === "string") return LEGACY_SORT_MAP[raw] ?? [];
    return [];
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
    this.chipsBarEl = root.createDiv({ cls: "pm-tasks-chips-bar" });
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
    const sortSection = drawerEl.createDiv({ cls: "pm-tasks-drawer__section" });
    sortSection.createDiv({ cls: "pm-tasks-drawer__section-label", text: "↕ SORT ORDER" });
    const sortContainer = sortSection.createDiv();
    const sortBuilder = new SortKeyBuilder(sortContainer, {
      keys: [...f.sortBy],
      onChange: (keys) => { f.sortBy = keys; onChange(); },
    });
    this.drawerComponents.push(sortBuilder);
    this.chipSelects = []; // reset — chipSelects are a subset of drawerComponents

    drawerEl.createEl("hr", { cls: "pm-tasks-drawer__divider" });

    // Completed + Due Date (2-col grid)
    const completedDueGrid = drawerEl.createDiv({ cls: "pm-tasks-drawer__grid" });

    // Completed (left)
    const completedSection = completedDueGrid.createDiv({ cls: "pm-tasks-drawer__section" });
    completedSection.createDiv({ cls: "pm-tasks-drawer__section-label", text: "✓ COMPLETED TASKS" });
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
    const dueDateSection = completedDueGrid.createDiv({ cls: "pm-tasks-drawer__section" });
    dueDateSection.createDiv({ cls: "pm-tasks-drawer__section-label", text: "📅 DUE DATE" });
    this.renderDrawerDueDateSection(dueDateSection, f, onChange);

    drawerEl.createEl("hr", { cls: "pm-tasks-drawer__divider" });

    // Priority + Context (2-col grid)
    const priCtxGrid = drawerEl.createDiv({ cls: "pm-tasks-drawer__grid" });
    const prioritySection = priCtxGrid.createDiv({ cls: "pm-tasks-drawer__section" });
    prioritySection.createDiv({ cls: "pm-tasks-drawer__section-label", text: "⚡ PRIORITY" });
    this.renderPillGroup(prioritySection, [
      { value: 1, label: "🔴 Urgent" },
      { value: 2, label: "🟠 High" },
      { value: 3, label: "🟡 Medium" },
      { value: 4, label: "🔵 Low" },
    ], f.priorityFilter, (val) => {
      const v = val as TaskPriority;
      if (f.priorityFilter.includes(v)) f.priorityFilter = f.priorityFilter.filter((p) => p !== v);
      else f.priorityFilter = [...f.priorityFilter, v];
      onChange();
    });

    const contextSection = priCtxGrid.createDiv({ cls: "pm-tasks-drawer__section" });
    contextSection.createDiv({ cls: "pm-tasks-drawer__section-label", text: "📁 CONTEXT TYPE" });
    this.renderPillGroup(contextSection, TASK_CONTEXTS.map((c) => ({ value: c, label: c })),
      f.contextFilter, (val) => {
        const v = val as TaskContext;
        if (f.contextFilter.includes(v)) f.contextFilter = f.contextFilter.filter((c) => c !== v);
        else f.contextFilter = [...f.contextFilter, v];
        onChange();
      });

    drawerEl.createEl("hr", { cls: "pm-tasks-drawer__divider" });

    // Client + Engagement (2-col grid)
    const clientEngGrid = drawerEl.createDiv({ cls: "pm-tasks-drawer__grid" });
    const clientSection = clientEngGrid.createDiv({ cls: "pm-tasks-drawer__section" });
    clientSection.createDiv({ cls: "pm-tasks-drawer__section-label", text: "🏢 CLIENT" });
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

    const engSection = clientEngGrid.createDiv({ cls: "pm-tasks-drawer__section" });
    engSection.createDiv({ cls: "pm-tasks-drawer__section-label", text: "📎 ENGAGEMENT" });
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

    drawerEl.createEl("hr", { cls: "pm-tasks-drawer__divider" });

    // Context-specific filters
    const ctxSpecSection = drawerEl.createDiv({ cls: "pm-tasks-drawer__section" });
    ctxSpecSection.createDiv({ cls: "pm-tasks-drawer__section-label", text: "⚙ CONTEXT-SPECIFIC FILTERS" });
    const ctxSpecGrid = ctxSpecSection.createDiv({ cls: "pm-tasks-drawer__grid" });

    const projStatusSection = ctxSpecGrid.createDiv({ cls: "pm-tasks-drawer__section" });
    projStatusSection.createEl("span", { text: "Project Status:", cls: "pm-tasks-drawer__section-label" });
    this.renderPillGroup(projStatusSection, (["New", "Active", "On Hold", "Complete"] as ProjectStatus[]).map((s) => ({ value: s, label: s })),
      f.projectStatusFilter, (val) => {
        const v = val as ProjectStatus;
        if (f.projectStatusFilter.includes(v)) f.projectStatusFilter = f.projectStatusFilter.filter((s) => s !== v);
        else f.projectStatusFilter = [...f.projectStatusFilter, v];
        onChange();
      });

    const inboxStatusSection = ctxSpecGrid.createDiv({ cls: "pm-tasks-drawer__section" });
    inboxStatusSection.createEl("span", { text: "Inbox Status:", cls: "pm-tasks-drawer__section-label" });
    this.renderPillGroup(inboxStatusSection, (["All", "Active", "Complete"] as InboxStatusFilter[]).map((s) => ({ value: s, label: s })),
      [f.inboxStatusFilter], (val) => {
        f.inboxStatusFilter = val as InboxStatusFilter;
        onChange();
      }, true /* single select */);

    const meetingDateSection = ctxSpecGrid.createDiv({ cls: "pm-tasks-drawer__section" });
    meetingDateSection.createEl("span", { text: "Meeting Date:", cls: "pm-tasks-drawer__section-label" });
    this.renderPillGroup(meetingDateSection, (["All", "Today", "This Week", "Past"] as MeetingDateFilter[]).map((s) => ({ value: s, label: s })),
      [f.meetingDateFilter], (val) => {
        f.meetingDateFilter = val as MeetingDateFilter;
        onChange();
      }, true /* single select */);

    drawerEl.createEl("hr", { cls: "pm-tasks-drawer__divider" });

    // Tags
    const tagsSection = drawerEl.createDiv({ cls: "pm-tasks-drawer__section" });
    tagsSection.createDiv({ cls: "pm-tasks-drawer__section-label", text: "🏷 TAGS" });
    const dv = this.services.queryService.dv();
    if (dv) {
      const allTasks = this.getAllTasks(dv);
      const allTags = [...new Set(allTasks.flatMap((t) => t.tags ?? []))].sort();
      if (allTags.length > 0) {
        const tagChipSelect = new FilterChipSelect(tagsSection, this.services.app, {
          options: allTags.map((tag) => ({ value: tag, displayText: tag })),
          selectedValues: [...f.tagFilter],
          placeholder: "type…",
          ariaLabel: "Filter by tag",
          includeUnassigned: f.includeUntagged,
          unassignedLabel: "Include untagged",
          onChange: (values, incl) => { f.tagFilter = values; f.includeUntagged = incl; onChange(); },
        });
        this.chipSelects.push(tagChipSelect);
        this.drawerComponents.push(tagChipSelect);
      }
    }

    // Clear Filters button at bottom of drawer
    const clearBtnRow = drawerEl.createDiv({ cls: "pm-tasks-drawer__section" });
    clearBtnRow.createEl("button", { text: "✕ Clear All Filters", cls: "pm-tasks-toolbar__clear-btn" })
      .addEventListener("click", () => {
        this.onSaveFilters?.(null);
        this.destroyDrawerComponents();
        this.isDrawerOpen = false;
        // Re-render entire dashboard from scratch
        const dashboard = root.closest(".pm-tasks-dashboard") ?? root;
        dashboard.empty();
        this.initFilters();
        this.renderControls(dashboard as HTMLElement);
        this.outputEl = (dashboard as HTMLElement).createDiv({ cls: "pm-tasks-dashboard__output" });
        void this.refreshDashboardOutput(this.outputEl);
      });
  }

  private renderDrawerDueDateSection(container: HTMLElement, f: DashboardFilters, onChange: () => void): void {
    // Preset pills
    const pillGroup = container.createDiv({ cls: "pm-tasks-pill-group" });
    const presets: DueDatePreset[] = [...DUE_DATE_PRESETS];
    for (const preset of presets) {
      const isActive = f.dueDateFilter.selectedPresets.includes(preset);
      const isOverdue = preset === "Overdue";
      const cls = isActive
        ? (isOverdue ? "pm-tasks-pill pm-tasks-pill--warn" : "pm-tasks-pill pm-tasks-pill--active")
        : "pm-tasks-pill";
      const pill = pillGroup.createEl("button", { cls, text: preset });
      pill.addEventListener("click", () => {
        const currentPresets = f.dueDateFilter.selectedPresets;
        if (currentPresets.includes(preset)) {
          f.dueDateFilter = { ...f.dueDateFilter, selectedPresets: currentPresets.filter((p) => p !== preset) };
        } else {
          // Adding a preset clears the custom range
          f.dueDateFilter = { selectedPresets: [...currentPresets, preset], rangeFrom: null, rangeTo: null };
          fromInput.value = "";
          toInput.value = "";
        }
        pill.className = f.dueDateFilter.selectedPresets.includes(preset)
          ? (preset === "Overdue" ? "pm-tasks-pill pm-tasks-pill--warn" : "pm-tasks-pill pm-tasks-pill--active")
          : "pm-tasks-pill";
        onChange();
      });
    }

    // Custom range
    const rangeRow = container.createDiv({ cls: "pm-date-range" });
    rangeRow.createSpan({ text: "From:" });
    const fromInput = rangeRow.createEl("input", { type: "date", cls: "pm-date-range-input" });
    fromInput.value = f.dueDateFilter.rangeFrom ?? "";
    fromInput.setAttribute("aria-label", "Filter from date");
    rangeRow.createSpan({ text: "→" });
    const toInput = rangeRow.createEl("input", { type: "date", cls: "pm-date-range-input" });
    toInput.value = f.dueDateFilter.rangeTo ?? "";
    toInput.setAttribute("aria-label", "Filter to date");

    fromInput.addEventListener("change", () => {
      f.dueDateFilter = {
        selectedPresets: [],
        rangeFrom: fromInput.value || null,
        rangeTo: f.dueDateFilter.rangeTo,
      };
      onChange();
    });
    toInput.addEventListener("change", () => {
      f.dueDateFilter = {
        selectedPresets: [],
        rangeFrom: f.dueDateFilter.rangeFrom,
        rangeTo: toInput.value || null,
      };
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
    const label = this.chipsBarEl.createEl("span");
    label.style.cssText = "font-size:var(--font-smaller);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;";
    label.textContent = "Filters:";
    for (const { label: chipLabel, onRemove } of chips) {
      const chip = this.chipsBarEl.createSpan({ cls: "pm-tasks-filter-chip" });
      chip.createSpan({ text: chipLabel });
      const removeBtn = chip.createSpan({ cls: "pm-tasks-filter-chip__remove", text: "×" });
      removeBtn.addEventListener("click", () => { onRemove(); });
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
      chips.push({ label: `📅 ${preset}`, onRemove: () => {
        f.dueDateFilter = { ...f.dueDateFilter, selectedPresets: f.dueDateFilter.selectedPresets.filter((p) => p !== preset) };
        rerender();
      }});
    }
    if (f.dueDateFilter.rangeFrom || f.dueDateFilter.rangeTo) {
      const rangeLabel = `📅 ${f.dueDateFilter.rangeFrom ?? "…"} → ${f.dueDateFilter.rangeTo ?? "…"}`;
      chips.push({ label: rangeLabel, onRemove: () => {
        f.dueDateFilter = { ...f.dueDateFilter, rangeFrom: null, rangeTo: null };
        rerender();
      }});
    }
    for (const p of f.priorityFilter) {
      const labels: Record<number, string> = { 1: "🔴 Urgent", 2: "🟠 High", 3: "🟡 Medium", 4: "🔵 Low" };
      chips.push({ label: `⚡ ${labels[p] ?? String(p)}`, onRemove: () => {
        f.priorityFilter = f.priorityFilter.filter((v) => v !== p);
        rerender();
      }});
    }
    for (const ctx of f.contextFilter) {
      chips.push({ label: `📁 ${ctx}`, onRemove: () => {
        f.contextFilter = f.contextFilter.filter((c) => c !== ctx);
        rerender();
      }});
    }
    for (const client of f.clientFilter) {
      chips.push({ label: `🏢 ${client}`, onRemove: () => {
        f.clientFilter = f.clientFilter.filter((c) => c !== client);
        rerender();
      }});
    }
    for (const eng of f.engagementFilter) {
      chips.push({ label: `📎 ${eng}`, onRemove: () => {
        f.engagementFilter = f.engagementFilter.filter((e) => e !== eng);
        rerender();
      }});
    }
    for (const tag of f.tagFilter) {
      chips.push({ label: `🏷 ${tag}`, onRemove: () => {
        f.tagFilter = f.tagFilter.filter((t) => t !== tag);
        rerender();
      }});
    }
    if (f.showCompleted) {
      chips.push({ label: "✓ Completed", onRemove: () => { f.showCompleted = false; rerender(); }});
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
    if (f.dueDateFilter.selectedPresets.length > 0 || f.dueDateFilter.rangeFrom !== null || f.dueDateFilter.rangeTo !== null) count++;
    if (f.priorityFilter.length > 0) count++;
    if (f.contextFilter.length > 0) count++;
    if (f.clientFilter.length > 0 || f.includeUnassignedClients) count++;
    if (f.engagementFilter.length > 0 || f.includeUnassignedEngagements) count++;
    if (f.projectStatusFilter.length > 0) count++;
    if (f.inboxStatusFilter !== "All") count++;
    if (f.meetingDateFilter !== "All") count++;
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
    outputEl.empty();

    const dv = this.services.queryService.dv();
    if (!dv) {
      outputEl.createEl("em", { text: MSG.DATAVIEW_UNAVAILABLE });
      return;
    }

    try {
      const f = this.filters;
      let allTasks = this.getAllTasks(dv);

      allTasks = this.filterService.applyDashboardFilters(
        allTasks,
        f,
        dv,
        this.services.queryService
      );

      if (allTasks.length === 0) {
        outputEl.createEl("em", { text: "No tasks match the current filters." });
        return;
      }

      // Pre-compute maps for new sort fields
      const folders = this.services.settings.folders;
      const contextMap = new Map(allTasks.map((t) => [t.path, getTaskContext(t, folders)]));
      const mtimeMap = new Map(allTasks.map((t) => [t.path, dv.page(t.path)?.file.mtime.valueOf() ?? 0]));

      const viewRenderers: Record<string, () => Promise<void>> = {
        [VIEW_MODE.CONTEXT]: () => this.contextRenderer.render(outputEl, allTasks, f, dv, contextMap, mtimeMap),
        [VIEW_MODE.DATE]: () => this.dateRenderer.render(outputEl, allTasks, f, contextMap, mtimeMap),
        [VIEW_MODE.PRIORITY]: () => this.priorityRenderer.render(outputEl, allTasks, f, contextMap, mtimeMap),
        [VIEW_MODE.TAG]: () => this.tagRenderer.render(outputEl, allTasks, f, contextMap, mtimeMap),
      };
      const viewRenderer = viewRenderers[f.viewMode];
      if (viewRenderer) {
        await viewRenderer();
      } else {
        renderError(outputEl, `Unknown view mode: ${String(f.viewMode)}`);
      }
    } catch (err) {
      this.services.loggerService.error(String(err), LOG_CONTEXT.TASKS_DASHBOARD, err);
      outputEl.empty();
      renderError(outputEl, `pm-tasks error: ${String(err)}`);
    }
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
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const dashboard = controlsEl.closest(".pm-tasks-dashboard");
      if (!dashboard) return;
      const outputEl = dashboard.querySelector(".pm-tasks-dashboard__output");
      if (outputEl instanceof HTMLElement) void this.refreshDashboardOutput(outputEl);
    }, DEBOUNCE_MS.SEARCH);
  }

  // ─── Task querying ────────────────────────────────────────────────────────

  private getAllTasks(dv: DataviewApi): DataviewTask[] {
    const utilityPrefix = this.services.settings.folders.utility + "/";
    const pages = [...dv.pages().where((p) => !p.file.path.startsWith(utilityPrefix))];
    return pages.flatMap((p) => [...p.file.tasks]);
  }

}
