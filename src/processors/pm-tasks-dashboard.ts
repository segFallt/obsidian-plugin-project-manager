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
  SortBy,
  ProjectStatus,
  TaskContext,
  TaskPriority,
} from "../types";
import { CONTEXT, ENTITY_TAGS, TASK_CONTEXTS, DEFAULT_TASK_VIEW_STATUSES, DUE_DATE_PRESETS, DEFAULT_DUE_DATE_FILTER, DEBOUNCE_MS, CSS_CLS, CSS_VAR, MSG } from "../constants";
import type { ITaskFilterService } from "../services/interfaces";
import type { ITaskSortService } from "../services/interfaces";
import { createSelect, renderCollapsible } from "./dom-helpers";
import { presetToDateRange } from "../utils/date-utils";
import type { TaskListRenderer } from "./task-list-renderer";
import { FilterChipSelect } from "../ui/components/filter-chip-select";
import { ContextViewRenderer } from "./dashboard-views/context-view-renderer";
import { DateViewRenderer } from "./dashboard-views/date-view-renderer";
import { PriorityViewRenderer } from "./dashboard-views/priority-view-renderer";
import { TagViewRenderer } from "./dashboard-views/tag-view-renderer";

/**
 * Renders the full dashboard mode: filter controls and all four view renderers
 * (context, date, priority, tag).
 */
export class DashboardView {
  private filters!: DashboardFilters;
  private outputEl!: HTMLElement;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private chipSelects: FilterChipSelect[] = [];
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
    this.initFilters();
    const root = this.containerEl.createDiv({ cls: "pm-tasks-dashboard" });
    const controlsEl = root.createDiv({ cls: "pm-tasks-dashboard__controls" });
    this.renderControls(controlsEl);
    this.outputEl = root.createDiv({ cls: "pm-tasks-dashboard__output" });
    this.refreshDashboardOutput(this.outputEl);
  }

  refreshOutput(): void {
    if (this.outputEl) this.refreshDashboardOutput(this.outputEl);
  }

  // ─── Filter initialisation ────────────────────────────────────────────────

  private initFilters(): void {
    const cfg = this.config;
    const saved = this.savedFilters;

    // Backward-compat migration: legacy saved state may be a string, an old
    // object with mode/presets fields, or the new rangeFrom/rangeTo/includeNoDate shape.
    const rawDueDate = saved?.dueDateFilter as unknown;
    let dueDateFilter: DueDateFilter;
    if (typeof rawDueDate === "string") {
      // Legacy string format: "All", "Today", "Tomorrow", etc.
      const validRangePresets: DueDatePreset[] = ["Today", "Tomorrow", "This Week", "Next Week", "Overdue"];
      if (rawDueDate === "No Date") {
        dueDateFilter = { rangeFrom: null, rangeTo: null, includeNoDate: true };
      } else if (validRangePresets.includes(rawDueDate as DueDatePreset)) {
        const range = presetToDateRange(rawDueDate as Exclude<DueDatePreset, "No Date">);
        dueDateFilter = { rangeFrom: range.rangeFrom, rangeTo: range.rangeTo, includeNoDate: false };
      } else {
        dueDateFilter = { ...DEFAULT_DUE_DATE_FILTER };
      }
    } else if (rawDueDate !== null && typeof rawDueDate === "object" && "mode" in rawDueDate) {
      // Legacy object format with mode/presets fields
      const legacy = rawDueDate as Record<string, unknown>;
      if (legacy["mode"] === "range") {
        dueDateFilter = {
          rangeFrom: (legacy["rangeFrom"] as string | null) ?? null,
          rangeTo: (legacy["rangeTo"] as string | null) ?? null,
          includeNoDate: false,
        };
      } else if (legacy["mode"] === "presets") {
        const presets = Array.isArray(legacy["presets"]) ? (legacy["presets"] as DueDatePreset[]) : [];
        if (presets.length === 1) {
          const p = presets[0];
          if (p === "No Date") {
            dueDateFilter = { rangeFrom: null, rangeTo: null, includeNoDate: true };
          } else {
            const range = presetToDateRange(p);
            dueDateFilter = { rangeFrom: range.rangeFrom, rangeTo: range.rangeTo, includeNoDate: false };
          }
        } else {
          dueDateFilter = { ...DEFAULT_DUE_DATE_FILTER };
        }
      } else {
        dueDateFilter = { ...DEFAULT_DUE_DATE_FILTER };
      }
    } else if (
      rawDueDate !== null &&
      typeof rawDueDate === "object" &&
      "rangeFrom" in rawDueDate &&
      "rangeTo" in rawDueDate &&
      "includeNoDate" in rawDueDate
    ) {
      // New format: use directly
      const newFormat = rawDueDate as DueDateFilter;
      dueDateFilter = { rangeFrom: newFormat.rangeFrom, rangeTo: newFormat.rangeTo, includeNoDate: newFormat.includeNoDate };
    } else {
      // No saved filter; fall back to config default or the empty default
      dueDateFilter = cfg.dueDateFilter ? { ...cfg.dueDateFilter } : { ...DEFAULT_DUE_DATE_FILTER };
    }

    this.filters = {
      viewMode: saved?.viewMode ?? cfg.viewMode ?? this.services.settings.ui.defaultTaskViewMode,
      sortBy: saved?.sortBy ?? cfg.sortBy ?? "none",
      showCompleted: saved?.showCompleted ?? cfg.showCompleted ?? this.services.settings.ui.showCompletedByDefault,
      contextFilter: saved?.contextFilter ?? cfg.contextFilter ?? [],
      dueDateFilter,
      priorityFilter: saved?.priorityFilter ?? cfg.priorityFilter ?? [],
      projectStatusFilter: saved?.projectStatusFilter ?? cfg.projectStatusFilter ?? [],
      inboxStatusFilter: saved?.inboxStatusFilter ?? cfg.inboxStatusFilter ?? "All",
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

  private renderControls(container: HTMLElement): void {
    const f = this.filters;

    // View mode selector
    const viewRow = container.createDiv({ cls: "pm-tasks-control-row" });
    viewRow.createEl("label", { text: "View:", cls: "pm-tasks-control-row__label" });
    const viewSelect = createSelect(viewRow, ["context", "date", "priority", "tag"], {
      context: "Context",
      date: "Due Date",
      priority: "Priority",
      tag: "Tag",
    });
    viewSelect.value = f.viewMode;
    viewSelect.setAttribute("aria-label", "View mode");
    viewSelect.addEventListener("change", () => {
      f.viewMode = viewSelect.value as typeof f.viewMode;
      this.persistFilters();
      this.debouncedRefresh(container);
    });

    // Sort selector
    const sortRow = container.createDiv({ cls: "pm-tasks-control-row" });
    sortRow.createEl("label", { text: "Sort:", cls: "pm-tasks-control-row__label" });
    const sortSelect = createSelect(sortRow, ["none", "dueDate-asc", "dueDate-desc", "priority-asc", "priority-desc"], {
      none: "None",
      "dueDate-asc": "Due Date ↑",
      "dueDate-desc": "Due Date ↓",
      "priority-asc": "Priority ↑",
      "priority-desc": "Priority ↓",
    });
    sortSelect.value = f.sortBy;
    sortSelect.setAttribute("aria-label", "Sort order");
    sortSelect.addEventListener("change", () => {
      f.sortBy = sortSelect.value as SortBy;
      this.persistFilters();
      this.debouncedRefresh(container);
    });

    // Show completed toggle
    const completedRow = container.createDiv({ cls: "pm-tasks-control-row" });
    completedRow.createEl("label", { text: "Show Completed:", cls: "pm-tasks-control-row__label" });
    const completedToggle = completedRow.createEl("input", { type: "checkbox" });
    completedToggle.checked = f.showCompleted;
    completedToggle.setAttribute("aria-label", "Show completed tasks");
    completedToggle.addEventListener("change", () => {
      f.showCompleted = completedToggle.checked;
      this.persistFilters();
      this.debouncedRefresh(container);
    });

    // Search
    const searchRow = container.createDiv({ cls: "pm-tasks-control-row" });
    searchRow.createEl("label", { text: "Search:", cls: "pm-tasks-control-row__label" });
    const searchInput = searchRow.createEl("input", {
      type: "text",
      placeholder: "Filter tasks…",
      cls: "pm-tasks-search",
    });
    searchInput.setAttribute("aria-label", "Search tasks");
    searchInput.addEventListener("input", () => {
      f.searchText = searchInput.value.toLowerCase();
      this.debouncedRefresh(container);
    });

    // Collapsible filter sections
    renderCollapsible(container, "Context Filters", (innerEl) => {
      this.renderContextFilters(innerEl, f, () => { this.persistFilters(); this.debouncedRefresh(container); });
    });
    renderCollapsible(container, "Date Filters", (innerEl) => {
      this.renderDateFilters(innerEl, f, () => { this.persistFilters(); this.debouncedRefresh(container); });
    });
    renderCollapsible(container, "Priority Filters", (innerEl) => {
      this.renderPriorityFilters(innerEl, f, () => { this.persistFilters(); this.debouncedRefresh(container); });
    });
    renderCollapsible(container, "Tag Filters", (innerEl) => {
      this.renderTagFilters(innerEl, f, () => { this.persistFilters(); this.debouncedRefresh(container); });
    });

    // Clear filters button
    const clearBtn = container.createEl("button", {
      text: "Clear Filters",
      cls: "pm-tasks-clear-btn",
    });
    clearBtn.addEventListener("click", () => {
      this.onSaveFilters?.(null);
      this.destroyChipSelects();
      this.initFilters();
      // Explicitly reset fields that may have been loaded from saved state
      const f = this.filters;
      f.tagFilter = [];
      f.includeUntagged = false;
      f.dueDateFilter = { ...DEFAULT_DUE_DATE_FILTER };
      const dashboardRoot = container.parentElement;
      if (dashboardRoot) {
        dashboardRoot.empty();
        const newControlsEl = dashboardRoot.createDiv({ cls: "pm-tasks-dashboard__controls" });
        this.renderControls(newControlsEl);
        this.outputEl = dashboardRoot.createDiv({ cls: "pm-tasks-dashboard__output" });
        this.refreshDashboardOutput(this.outputEl);
      }
    });
  }

  private renderContextFilters(
    container: HTMLElement,
    f: DashboardFilters,
    onChange: () => void
  ): void {
    // Context type multi-select
    container.createEl("label", { text: "Context Type:" });
    const contexts: TaskContext[] = [...TASK_CONTEXTS];
    const ctxGroup = container.createDiv({ cls: "pm-checkbox-group" });
    for (const ctx of contexts) {
      const label = ctxGroup.createEl("label", { cls: "pm-checkbox-label" });
      const cb = label.createEl("input", { type: "checkbox" });
      cb.checked = f.contextFilter.includes(ctx);
      cb.setAttribute("aria-label", `Filter by context: ${ctx}`);
      label.createSpan({ text: ctx });
      cb.addEventListener("change", () => {
        if (cb.checked) f.contextFilter.push(ctx);
        else f.contextFilter = f.contextFilter.filter((c) => c !== ctx);
        onChange();
      });
    }

    // Client filter (multi-select chip select)
    const activeClients = this.services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.client);
    if (activeClients.length > 0) {
      container.createEl("label", { text: "Client:", cls: "pm-filter-label" });
      const clientChipSelect = new FilterChipSelect(
        container,
        this.services.app,
        {
          options: activeClients.map((p) => ({ value: p.file.name, displayText: p.file.name })),
          selectedValues: [...f.clientFilter],
          placeholder: "Add client filter…",
          ariaLabel: "Filter by client",
          includeUnassigned: f.includeUnassignedClients,
          unassignedLabel: "Include unassigned clients",
          onChange: (values, includeUnassigned) => {
            f.clientFilter = values;
            f.includeUnassignedClients = includeUnassigned;
            onChange();
          },
        }
      );
      this.chipSelects.push(clientChipSelect);
    }

    // Engagement filter (multi-select chip select)
    const activeEngagements = this.services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.engagement);
    if (activeEngagements.length > 0) {
      container.createEl("label", { text: "Engagement:", cls: "pm-filter-label" });
      const engChipSelect = new FilterChipSelect(
        container,
        this.services.app,
        {
          options: activeEngagements.map((p) => ({ value: p.file.name, displayText: p.file.name })),
          selectedValues: [...f.engagementFilter],
          placeholder: "Add engagement filter…",
          ariaLabel: "Filter by engagement",
          includeUnassigned: f.includeUnassignedEngagements,
          unassignedLabel: "Include unassigned engagements",
          onChange: (values, includeUnassigned) => {
            f.engagementFilter = values;
            f.includeUnassignedEngagements = includeUnassigned;
            onChange();
          },
        }
      );
      this.chipSelects.push(engChipSelect);
    }

    // Project status filter
    container.createEl("label", { text: "Project Status:", cls: "pm-filter-label" });
    const projectStatuses: ProjectStatus[] = [...DEFAULT_TASK_VIEW_STATUSES] as ProjectStatus[];
    const psGroup = container.createDiv({ cls: "pm-checkbox-group" });
    for (const status of projectStatuses) {
      const label = psGroup.createEl("label", { cls: "pm-checkbox-label" });
      const cb = label.createEl("input", { type: "checkbox" });
      cb.checked = f.projectStatusFilter.includes(status);
      label.createSpan({ text: status });
      cb.addEventListener("change", () => {
        if (cb.checked) f.projectStatusFilter.push(status);
        else f.projectStatusFilter = f.projectStatusFilter.filter((s) => s !== status);
        onChange();
      });
    }

    // Inbox status
    container.createEl("label", { text: "Inbox Status:", cls: "pm-filter-label" });
    const inboxSelect = createSelect(container, ["All", "Active", "Inactive"], {});
    inboxSelect.value = f.inboxStatusFilter;
    inboxSelect.addEventListener("change", () => {
      f.inboxStatusFilter = inboxSelect.value as InboxStatusFilter;
      onChange();
    });

    // Meeting date
    container.createEl("label", { text: "Meeting Date:", cls: "pm-filter-label" });
    const meetingSelect = createSelect(container, ["All", "Today", "This Week", "Past"], {});
    meetingSelect.value = f.meetingDateFilter;
    meetingSelect.addEventListener("change", () => {
      f.meetingDateFilter = meetingSelect.value as MeetingDateFilter;
      onChange();
    });
  }

  private renderDateFilters(
    container: HTMLElement,
    f: DashboardFilters,
    onChange: () => void
  ): void {
    const section = container.createEl("div", { cls: "pm-filter-group" });
    section.createEl("span", { cls: "pm-filter-label", text: "Due:" });

    // Derive the initial active preset from the current filter state.
    // "No Date" is tracked via includeNoDate, not activePreset.
    const rangePresets: Exclude<DueDatePreset, "No Date">[] = ["Today", "Tomorrow", "This Week", "Next Week", "Overdue"];
    let activePreset: Exclude<DueDatePreset, "No Date"> | null = null;
    for (const p of rangePresets) {
      const r = presetToDateRange(p);
      if (r.rangeFrom === f.dueDateFilter.rangeFrom && r.rangeTo === f.dueDateFilter.rangeTo) {
        activePreset = p;
        break;
      }
    }

    // Preset buttons container
    const presetsContainer = section.createEl("div", { cls: "pm-date-presets" });
    const presetButtons = new Map<DueDatePreset, HTMLElement>();

    // Range inputs are declared before the preset button loop so their
    // references are fully initialised when the preset click handlers close
    // over them (avoids a TDZ hazard).
    const rangeContainer = section.createEl("div", { cls: "pm-date-range" });
    rangeContainer.createEl("span", { text: "From:" });
    const fromInput = rangeContainer.createEl("input", { type: "date", cls: "pm-date-range-input" });
    fromInput.value = f.dueDateFilter.rangeFrom ?? "";
    fromInput.setAttribute("aria-label", "Filter from date");
    rangeContainer.createEl("span", { text: "To:" });
    const toInput = rangeContainer.createEl("input", { type: "date", cls: "pm-date-range-input" });
    toInput.value = f.dueDateFilter.rangeTo ?? "";
    toInput.setAttribute("aria-label", "Filter to date");

    // Helper: sync CSS active class on all preset buttons from current state.
    function updatePresetHighlights(): void {
      for (const [preset, btn] of presetButtons) {
        if (preset === "No Date") {
          btn.classList.toggle("--active", f.dueDateFilter.includeNoDate);
        } else {
          btn.classList.toggle("--active", preset === activePreset);
        }
      }
    }

    for (const preset of DUE_DATE_PRESETS) {
      const btn = presetsContainer.createEl("button", {
        cls: "pm-date-preset-btn",
        text: preset,
      });
      presetButtons.set(preset, btn);

      if (preset === "No Date") {
        btn.addEventListener("click", () => {
          f.dueDateFilter.includeNoDate = !f.dueDateFilter.includeNoDate;
          // Do NOT touch rangeFrom/rangeTo or activePreset
          updatePresetHighlights();
          onChange();
        });
      } else {
        btn.addEventListener("click", () => {
          if (activePreset === preset) {
            // Toggle off: clear the range
            f.dueDateFilter.rangeFrom = null;
            f.dueDateFilter.rangeTo = null;
            activePreset = null;
            fromInput.value = "";
            toInput.value = "";
          } else {
            const range = presetToDateRange(preset);
            f.dueDateFilter.rangeFrom = range.rangeFrom;
            f.dueDateFilter.rangeTo = range.rangeTo;
            activePreset = preset;
            fromInput.value = range.rangeFrom ?? "";
            toInput.value = range.rangeTo ?? "";
          }
          // Do NOT touch includeNoDate
          updatePresetHighlights();
          onChange();
        });
      }
    }

    fromInput.addEventListener("change", () => {
      f.dueDateFilter.rangeFrom = fromInput.value || null;
      activePreset = null; // manual edit clears preset highlight
      updatePresetHighlights();
      onChange();
    });
    toInput.addEventListener("change", () => {
      f.dueDateFilter.rangeTo = toInput.value || null;
      activePreset = null; // manual edit clears preset highlight
      updatePresetHighlights();
      onChange();
    });

    // Set initial highlight state
    updatePresetHighlights();
  }

  private renderPriorityFilters(
    container: HTMLElement,
    f: DashboardFilters,
    onChange: () => void
  ): void {
    container.createEl("label", { text: "Priority:" });
    const priGroup = container.createDiv({ cls: "pm-checkbox-group" });
    const priorities: Array<{ value: TaskPriority; label: string }> = [
      { value: 1, label: "Urgent" },
      { value: 2, label: "High" },
      { value: 3, label: "Medium" },
      { value: 4, label: "Low" },
      { value: 5, label: "Someday" },
    ];
    for (const { value, label } of priorities) {
      const labelEl = priGroup.createEl("label", { cls: "pm-checkbox-label" });
      const cb = labelEl.createEl("input", { type: "checkbox" });
      cb.checked = f.priorityFilter.includes(value);
      cb.setAttribute("aria-label", `Filter by priority: ${label}`);
      labelEl.createSpan({ text: label });
      cb.addEventListener("change", () => {
        if (cb.checked) f.priorityFilter.push(value);
        else f.priorityFilter = f.priorityFilter.filter((p) => p !== value);
        onChange();
      });
    }
  }

  private renderTagFilters(
    container: HTMLElement,
    f: DashboardFilters,
    onChange: () => void
  ): void {
    // Collect unique tags from all tasks currently in the vault
    const dv = this.services.queryService.dv();
    if (!dv) {
      container.createEl("div", {
        cls: "pm-filter-group",
        text: "Tag filters unavailable (Dataview not loaded)",
      });
      return;
    }
    const allTasks = this.getAllTasks(dv);
    const allTags = [...new Set(allTasks.flatMap(t => t.tags ?? []))].sort();

    if (allTags.length === 0) return;

    container.createEl("label", { text: "Tags:", cls: "pm-filter-label" });
    const tagChipSelect = new FilterChipSelect(
      container,
      this.services.app,
      {
        options: allTags.map((tag) => ({ value: tag, displayText: tag })),
        selectedValues: [...f.tagFilter],
        placeholder: "Add tag filter...",
        ariaLabel: "Filter by tag",
        includeUnassigned: f.includeUntagged,
        unassignedLabel: "Include untagged",
        onChange: (values, includeUnassigned) => {
          f.tagFilter = values;
          f.includeUntagged = includeUnassigned;
          onChange();
        },
      }
    );
    this.chipSelects.push(tagChipSelect);
  }

  // ─── Chip select cleanup ─────────────────────────────────────────────────

  private destroyChipSelects(): void {
    for (const cs of this.chipSelects) cs.destroy();
    this.chipSelects = [];
  }

  // ─── Output rendering ─────────────────────────────────────────────────────

  private refreshDashboardOutput(outputEl: HTMLElement): void {
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

      switch (f.viewMode) {
        case "context":
          this.contextRenderer.render(outputEl, allTasks, f, dv);
          break;
        case "date":
          this.dateRenderer.render(outputEl, allTasks, f);
          break;
        case "priority":
          this.priorityRenderer.render(outputEl, allTasks, f);
          break;
        case "tag":
          this.tagRenderer.render(outputEl, allTasks, f);
          break;
      }
    } catch (err) {
      this.services.loggerService.error(String(err), "pm-tasks-dashboard", err);
      outputEl.empty();
      const errEl = outputEl.createDiv({ cls: CSS_CLS.PM_ERROR });
      errEl.style.color = CSS_VAR.TEXT_ERROR;
      errEl.textContent = `pm-tasks error: ${String(err)}`;
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
      if (outputEl instanceof HTMLElement) this.refreshDashboardOutput(outputEl);
    }, DEBOUNCE_MS.SEARCH);
  }

  // ─── Task querying ────────────────────────────────────────────────────────

  private getAllTasks(dv: DataviewApi): DataviewTask[] {
    const utilityPrefix = this.services.settings.folders.utility + "/";
    const pages = [...dv.pages().where((p) => !p.file.path.startsWith(utilityPrefix))];
    return pages.flatMap((p) => [...p.file.tasks]);
  }

}
