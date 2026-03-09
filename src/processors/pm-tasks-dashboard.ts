import type { PluginServices } from "../plugin-context";
import type {
  PmTasksConfig,
  DataviewApi,
  DataviewTask,
  DashboardFilters,
  SavedDashboardFilters,
  DueDateFilter,
  MeetingDateFilter,
  InboxStatusFilter,
  SortBy,
  ProjectStatus,
  TaskContext,
  TaskPriority,
} from "../types";
import { PRIORITY_DISPLAY, ENTITY_TAGS, TASK_CONTEXTS, DEFAULT_TASK_VIEW_STATUSES, ISO_DATE_LENGTH, WEEK_DAYS, DEBOUNCE_MS } from "../constants";
import { todayISO } from "../utils/date-utils";
import {
  getTaskContext,
  getTaskPriority,
  addDays,
} from "../utils/task-utils";
import { normalizeToName } from "../utils/link-utils";
import type { ITaskFilterService } from "../services/interfaces";
import type { ITaskSortService } from "../services/interfaces";
import { createSelect, renderCollapsible } from "./dom-helpers";
import type { TaskListRenderer } from "./task-list-renderer";
import { FilterChipSelect } from "../ui/components/filter-chip-select";

/**
 * Renders the full dashboard mode: filter controls and all four view renderers
 * (context, date, priority, tag).
 */
export class DashboardView {
  private filters!: DashboardFilters;
  private outputEl!: HTMLElement;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private chipSelects: FilterChipSelect[] = [];

  constructor(
    private readonly containerEl: HTMLElement,
    private readonly config: PmTasksConfig,
    private readonly services: PluginServices,
    private readonly filterService: ITaskFilterService,
    private readonly sortService: ITaskSortService,
    private readonly renderer: TaskListRenderer,
    private readonly savedFilters?: SavedDashboardFilters | null,
    private readonly onSaveFilters?: ((filters: SavedDashboardFilters | null) => void) | null
  ) {}

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
    this.filters = {
      viewMode: saved?.viewMode ?? cfg.viewMode ?? this.services.settings.ui.defaultTaskViewMode,
      sortBy: saved?.sortBy ?? cfg.sortBy ?? "none",
      showCompleted: saved?.showCompleted ?? cfg.showCompleted ?? this.services.settings.ui.showCompletedByDefault,
      contextFilter: saved?.contextFilter ?? cfg.contextFilter ?? [],
      dueDateFilter: saved?.dueDateFilter ?? cfg.dueDateFilter ?? "All",
      priorityFilter: saved?.priorityFilter ?? cfg.priorityFilter ?? [],
      projectStatusFilter: saved?.projectStatusFilter ?? cfg.projectStatusFilter ?? [],
      inboxStatusFilter: saved?.inboxStatusFilter ?? cfg.inboxStatusFilter ?? "All",
      meetingDateFilter: saved?.meetingDateFilter ?? cfg.meetingDateFilter ?? "All",
      clientFilter: saved?.clientFilter ?? [],
      engagementFilter: saved?.engagementFilter ?? [],
      includeUnassignedClients: saved?.includeUnassignedClients ?? false,
      includeUnassignedEngagements: saved?.includeUnassignedEngagements ?? false,
      searchText: "",
    };
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

    // Clear filters button
    const clearBtn = container.createEl("button", {
      text: "Clear Filters",
      cls: "pm-tasks-clear-btn",
    });
    clearBtn.addEventListener("click", () => {
      this.onSaveFilters?.(null);
      this.destroyChipSelects();
      this.initFilters();
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
    container.createEl("label", { text: "Due Date:" });
    const dueDateSelect = createSelect(
      container,
      ["All", "Today", "This Week", "Overdue", "No Date"],
      {}
    );
    dueDateSelect.value = f.dueDateFilter;
    dueDateSelect.addEventListener("change", () => {
      f.dueDateFilter = dueDateSelect.value as DueDateFilter;
      onChange();
    });
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
      outputEl.createEl("em", { text: "Dataview is not available. Install and enable the Dataview plugin." });
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
          this.renderByContext(outputEl, allTasks, f, dv);
          break;
        case "date":
          this.renderByDate(outputEl, allTasks, f);
          break;
        case "priority":
          this.renderByPriority(outputEl, allTasks, f);
          break;
        case "tag":
          this.renderByTag(outputEl, allTasks, f);
          break;
      }
    } catch (err) {
      this.services.loggerService.error(String(err), "pm-tasks-dashboard", err);
      outputEl.empty();
      const errEl = outputEl.createDiv({ cls: "pm-error" });
      errEl.style.color = "var(--text-error)";
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

  // ─── View mode renderers ─────────────────────────────────────────────────

  private renderByContext(
    container: HTMLElement,
    tasks: DataviewTask[],
    f: DashboardFilters,
    dv: DataviewApi
  ): void {
    const allContexts: TaskContext[] = [...TASK_CONTEXTS];

    for (const context of allContexts) {
      const ctxTasks = tasks.filter((t) => getTaskContext(t, this.services.settings.folders) === context);
      if (ctxTasks.length === 0) continue;

      container.createEl("h2", { text: context });

      // Group by file (project notes → under parent project)
      const byFile: Record<string, DataviewTask[]> = {};
      const projectNoteMapping: Record<string, Record<string, DataviewTask[]>> = {};

      for (const task of ctxTasks) {
        const filePath = task.link.path;

        if (context === "Project") {
          const parentProjectPath = this.getParentProjectPath(filePath, dv);
          if (parentProjectPath) {
            if (!byFile[parentProjectPath]) {
              byFile[parentProjectPath] = [];
            }
            if (!projectNoteMapping[parentProjectPath]) {
              projectNoteMapping[parentProjectPath] = {};
            }
            if (!projectNoteMapping[parentProjectPath][filePath]) {
              projectNoteMapping[parentProjectPath][filePath] = [];
            }
            projectNoteMapping[parentProjectPath][filePath].push(task);
            byFile[parentProjectPath].push(task);
            continue;
          }
        }

        if (!byFile[filePath]) byFile[filePath] = [];
        byFile[filePath].push(task);
      }

      const fileGroups = Object.entries(byFile)
        .map(([fp, ts]) => ({ filePath: fp, tasks: ts }))
        .sort((a, b) => this.sortService.compareGroups(a.tasks, b.tasks, f.sortBy));

      for (const { filePath, tasks: fileTasks } of fileGroups) {
        const page = dv.page(filePath);
        const name = page?.file.name ?? filePath;
        container.createEl("h3").innerHTML = `<a class="internal-link" data-href="${filePath}" href="${filePath}">${name}</a>`;

        if (context === "Project" && projectNoteMapping[filePath]) {
          // Direct project tasks first
          const directTasks = fileTasks.filter((t) => t.link.path === filePath);
          if (directTasks.length > 0) {
            this.renderer.renderTaskList(container, this.sortService.sortTasks(directTasks, f.sortBy));
          }
          // Then note sub-sections
          for (const [notePath, noteTasks] of Object.entries(projectNoteMapping[filePath])) {
            const notePage = dv.page(notePath);
            const noteName = notePage?.file.name ?? notePath;
            container.createEl("h4").innerHTML = `<a class="internal-link" data-href="${notePath}" href="${notePath}">${noteName}</a>`;
            this.renderer.renderTaskList(container, this.sortService.sortTasks(noteTasks, f.sortBy));
          }
        } else {
          this.renderer.renderTaskList(container, this.sortService.sortTasks(fileTasks, f.sortBy));
        }
      }
    }
  }

  private renderByDate(container: HTMLElement, tasks: DataviewTask[], f: DashboardFilters): void {
    const today = todayISO();
    const tomorrow = addDays(today, 1);
    const weekEnd = addDays(today, WEEK_DAYS);

    const overdue = tasks.filter((t) => t.due && String(t.due).substring(0, ISO_DATE_LENGTH) < today);
    const todayTasks = tasks.filter((t) => t.due && String(t.due).substring(0, ISO_DATE_LENGTH) === today);
    const tomorrowTasks = tasks.filter((t) => t.due && String(t.due).substring(0, ISO_DATE_LENGTH) === tomorrow);
    const thisWeek = tasks.filter((t) => {
      if (!t.due) return false;
      const d = String(t.due).substring(0, ISO_DATE_LENGTH);
      return d > tomorrow && d <= weekEnd;
    });
    const upcoming = tasks.filter((t) => t.due && String(t.due).substring(0, ISO_DATE_LENGTH) > weekEnd);
    const noDue = tasks.filter((t) => !t.due);

    if (overdue.length > 0) {
      container.createEl("h2", { text: "⚠️ Overdue" });
      this.renderer.renderTaskList(container, this.sortService.sortTasks(overdue, f.sortBy || "dueDate-asc"));
    }
    if (todayTasks.length > 0) {
      container.createEl("h2", { text: "📅 Today" });
      this.renderer.renderTaskList(container, this.sortService.sortTasks(todayTasks, f.sortBy || "priority-asc"));
    }
    if (tomorrowTasks.length > 0) {
      container.createEl("h2", { text: "📆 Tomorrow" });
      this.renderer.renderTaskList(container, this.sortService.sortTasks(tomorrowTasks, f.sortBy || "priority-asc"));
    }
    if (thisWeek.length > 0) {
      container.createEl("h2", { text: "📋 This Week" });
      this.renderer.renderTaskList(container, this.sortService.sortTasks(thisWeek, f.sortBy || "dueDate-asc"));
    }
    if (upcoming.length > 0) {
      container.createEl("h2", { text: "🔮 Upcoming" });
      this.renderer.renderTaskList(container, this.sortService.sortTasks(upcoming, f.sortBy || "dueDate-asc"));
    }
    if (noDue.length > 0) {
      container.createEl("h2", { text: "📝 No Due Date" });
      this.renderer.renderTaskList(container, this.sortService.sortTasks(noDue, f.sortBy || "priority-asc"));
    }
  }

  private renderByPriority(container: HTMLElement, tasks: DataviewTask[], f: DashboardFilters): void {
    for (let priority = 1; priority <= 5; priority++) {
      const priTasks = tasks.filter((t) => getTaskPriority(t) === priority);
      if (priTasks.length === 0) continue;
      container.createEl("h2", { text: PRIORITY_DISPLAY[priority] });
      this.renderer.renderTaskList(container, this.sortService.sortTasks(priTasks, f.sortBy));
    }
  }

  private renderByTag(container: HTMLElement, tasks: DataviewTask[], f: DashboardFilters): void {
    const tagMap: Record<string, DataviewTask[]> = {};
    const untagged: DataviewTask[] = [];

    for (const task of tasks) {
      const tags = task.tags ?? [];
      if (tags.length === 0) {
        untagged.push(task);
      } else {
        for (const tag of tags) {
          if (!tagMap[tag]) tagMap[tag] = [];
          tagMap[tag].push(task);
        }
      }
    }

    for (const tag of Object.keys(tagMap).sort()) {
      container.createEl("h2", { text: tag });
      this.renderer.renderTaskList(container, this.sortService.sortTasks(tagMap[tag], f.sortBy));
    }

    if (untagged.length > 0) {
      container.createEl("h2", { text: "📌 Untagged" });
      this.renderer.renderTaskList(container, this.sortService.sortTasks(untagged, f.sortBy));
    }
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private getParentProjectPath(filePath: string, dv: DataviewApi): string | null {
    const page = dv.page(filePath);
    if (!page?.relatedProject) return null;
    const projectName = normalizeToName(page.relatedProject);
    if (!projectName) return null;
    return `${this.services.settings.folders.projects}/${projectName}.md`;
  }
}
