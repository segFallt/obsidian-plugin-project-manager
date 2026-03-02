import { MarkdownRenderChild, TFile, parseYaml } from "obsidian";
import type ProjectManagerPlugin from "../main";
import type {
  PmTasksConfig,
  DataviewPage,
  DataviewTask,
  TaskContext,
  TaskPriority,
  DueDateFilter,
  MeetingDateFilter,
  InboxStatusFilter,
  SortBy,
  ProjectStatus,
} from "../types";
import {
  PRIORITY_DISPLAY,
  PRIORITY_EMOJI,
  DEFAULT_TASK_VIEW_STATUSES,
  DUE_DATE_EMOJI,
} from "../constants";
import { todayISO } from "../utils/date-utils";
import { normalizeToName } from "../utils/link-utils";

/**
 * Renders the task dashboard and tasks-by-project views.
 *
 * Replaces the vault's tasks-dashboard.js (~567 lines) and tasks-by-project.js (~199 lines),
 * along with their Meta Bind filter controls.
 *
 * Usage:
 * ```pm-tasks
 * mode: dashboard
 * ```
 * ```pm-tasks
 * mode: by-project
 * ```
 *
 * All filter state is local to the component — no frontmatter writes.
 */
export function registerPmTasksProcessor(plugin: ProjectManagerPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor("pm-tasks", (source, el, ctx) => {
    const child = new PmTasksRenderChild(el, source, plugin);
    ctx.addChild(child);
    child.render();
  });
}

// ─── Types local to this processor ────────────────────────────────────────

interface DashboardFilters {
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

interface ByProjectFilters {
  selectedStatuses: ProjectStatus[];
  projectFilter: string;
  clientFilter: string[];
  engagementFilter: string[];
  includeUnassignedClients: boolean;
  includeUnassignedEngagements: boolean;
  showCompleted: boolean;
}

// ─── Render child ──────────────────────────────────────────────────────────

class PmTasksRenderChild extends MarkdownRenderChild {
  private config!: PmTasksConfig;
  private dashFilters!: DashboardFilters;
  private byProjectFilters!: ByProjectFilters;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  // Reference to the output element — allows auto-refresh without re-rendering controls
  private outputEl: HTMLElement | null = null;

  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly plugin: ProjectManagerPlugin
  ) {
    super(containerEl);
  }

  onload(): void {
    // Auto-refresh task output when any vault file is modified.
    // Uses a 1 second debounce to allow Dataview to re-index before querying.
    this.registerEvent(
      this.plugin.app.vault.on("modify", () => {
        this.debouncedAutoRefresh();
      })
    );
  }

  onunload(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  render(): void {
    this.containerEl.empty();

    try {
      this.config = parseYaml(this.source) as PmTasksConfig;
    } catch {
      this.renderError("Invalid pm-tasks config.");
      return;
    }

    if (!this.config?.mode) {
      this.renderError("pm-tasks requires a `mode` field (dashboard or by-project).");
      return;
    }

    if (this.config.mode === "dashboard") {
      this.initDashboardFilters();
      this.renderDashboard();
    } else if (this.config.mode === "by-project") {
      this.initByProjectFilters();
      this.renderByProject();
    } else {
      this.renderError(`Unknown pm-tasks mode: ${String(this.config.mode)}`);
    }
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────

  private initDashboardFilters(): void {
    const cfg = this.config;
    this.dashFilters = {
      viewMode: cfg.viewMode ?? this.plugin.settings.ui.defaultTaskViewMode,
      sortBy: cfg.sortBy ?? "none",
      showCompleted: cfg.showCompleted ?? this.plugin.settings.ui.showCompletedByDefault,
      contextFilter: cfg.contextFilter ?? [],
      dueDateFilter: cfg.dueDateFilter ?? "All",
      priorityFilter: cfg.priorityFilter ?? [],
      projectStatusFilter: cfg.projectStatusFilter ?? [],
      inboxStatusFilter: cfg.inboxStatusFilter ?? "All",
      meetingDateFilter: cfg.meetingDateFilter ?? "All",
      clientFilter: [],
      engagementFilter: [],
      includeUnassignedClients: false,
      includeUnassignedEngagements: false,
      searchText: "",
    };
  }

  private renderDashboard(): void {
    const root = this.containerEl.createDiv({ cls: "pm-tasks-dashboard" });

    // Controls section
    const controlsEl = root.createDiv({ cls: "pm-tasks-dashboard__controls" });
    this.renderDashboardControls(controlsEl);

    // Tasks output
    const outputEl = root.createDiv({ cls: "pm-tasks-dashboard__output" });
    this.outputEl = outputEl;
    this.refreshDashboardOutput(outputEl);
  }

  private renderDashboardControls(container: HTMLElement): void {
    const f = this.dashFilters;

    // View mode selector
    const viewRow = container.createDiv({ cls: "pm-tasks-control-row" });
    viewRow.createEl("label", { text: "View:", cls: "pm-tasks-control-row__label" });
    const viewSelect = this.createSelect(viewRow, ["context", "date", "priority", "tag"], {
      context: "Context",
      date: "Due Date",
      priority: "Priority",
      tag: "Tag",
    });
    viewSelect.value = f.viewMode;
    viewSelect.setAttribute("aria-label", "View mode");
    viewSelect.addEventListener("change", () => {
      f.viewMode = viewSelect.value as typeof f.viewMode;
      this.debouncedRefresh(container);
    });

    // Sort selector
    const sortRow = container.createDiv({ cls: "pm-tasks-control-row" });
    sortRow.createEl("label", { text: "Sort:", cls: "pm-tasks-control-row__label" });
    const sortSelect = this.createSelect(sortRow, ["none", "dueDate-asc", "dueDate-desc", "priority-asc", "priority-desc"], {
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
    this.renderCollapsible(container, "Context Filters", (innerEl) => {
      this.renderContextFilters(innerEl, f, () => this.debouncedRefresh(container));
    });

    this.renderCollapsible(container, "Date Filters", (innerEl) => {
      this.renderDateFilters(innerEl, f, () => this.debouncedRefresh(container));
    });

    this.renderCollapsible(container, "Priority Filters", (innerEl) => {
      this.renderPriorityFilters(innerEl, f, () => this.debouncedRefresh(container));
    });

    // Clear filters button
    const clearBtn = container.createEl("button", {
      text: "Clear Filters",
      cls: "pm-tasks-clear-btn",
    });
    clearBtn.addEventListener("click", () => {
      this.initDashboardFilters();
      const parentDashboard = container.parentElement;
      if (parentDashboard) {
        parentDashboard.empty();
        const newControlsEl = parentDashboard.createDiv({ cls: "pm-tasks-dashboard__controls" });
        this.renderDashboardControls(newControlsEl);
        const newOutputEl = parentDashboard.createDiv({ cls: "pm-tasks-dashboard__output" });
        this.refreshDashboardOutput(newOutputEl);
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
    const contexts: TaskContext[] = ["Project", "Person", "Meeting", "Inbox", "Daily Notes"];
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

    // Client filter
    const activeClients = this.plugin.queryService.getActiveEntitiesByTag("#client");
    if (activeClients.length > 0) {
      container.createEl("label", { text: "Client:", cls: "pm-filter-label" });
      const clientSelect = container.createEl("select", {
        cls: "pm-tasks-filter-select dropdown",
      });
      clientSelect.createEl("option", { text: "(All Clients)", value: "" });
      for (const p of activeClients) {
        clientSelect.createEl("option", { text: p.file.name, value: p.file.name });
      }
      clientSelect.addEventListener("change", () => {
        f.clientFilter = clientSelect.value ? [clientSelect.value] : [];
        onChange();
      });

      const unassignedClientLabel = container.createEl("label", { cls: "pm-checkbox-label" });
      const unassignedClientCb = unassignedClientLabel.createEl("input", { type: "checkbox" });
      unassignedClientLabel.createSpan({ text: "Include unassigned clients" });
      unassignedClientCb.addEventListener("change", () => {
        f.includeUnassignedClients = unassignedClientCb.checked;
        onChange();
      });
    }

    // Engagement filter
    const activeEngagements = this.plugin.queryService.getActiveEntitiesByTag("#engagement");
    if (activeEngagements.length > 0) {
      container.createEl("label", { text: "Engagement:", cls: "pm-filter-label" });
      const engSelect = container.createEl("select", {
        cls: "pm-tasks-filter-select dropdown",
      });
      engSelect.createEl("option", { text: "(All Engagements)", value: "" });
      for (const p of activeEngagements) {
        engSelect.createEl("option", { text: p.file.name, value: p.file.name });
      }
      engSelect.addEventListener("change", () => {
        f.engagementFilter = engSelect.value ? [engSelect.value] : [];
        onChange();
      });

      const unassignedEngLabel = container.createEl("label", { cls: "pm-checkbox-label" });
      const unassignedEngCb = unassignedEngLabel.createEl("input", { type: "checkbox" });
      unassignedEngLabel.createSpan({ text: "Include unassigned engagements" });
      unassignedEngCb.addEventListener("change", () => {
        f.includeUnassignedEngagements = unassignedEngCb.checked;
        onChange();
      });
    }

    // Project status filter
    container.createEl("label", { text: "Project Status:", cls: "pm-filter-label" });
    const projectStatuses: ProjectStatus[] = ["New", "Active", "On Hold"];
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
    const inboxSelect = this.createSelect(container, ["All", "Active", "Inactive"], {});
    inboxSelect.value = f.inboxStatusFilter;
    inboxSelect.addEventListener("change", () => {
      f.inboxStatusFilter = inboxSelect.value as InboxStatusFilter;
      onChange();
    });

    // Meeting date
    container.createEl("label", { text: "Meeting Date:", cls: "pm-filter-label" });
    const meetingSelect = this.createSelect(container, ["All", "Today", "This Week", "Past"], {});
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
    const dueDateSelect = this.createSelect(
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

  private refreshDashboardOutput(outputEl: HTMLElement): void {
    outputEl.empty();

    const dv = (this.plugin.queryService as unknown as { dv: () => import("../types").DataviewApi | null }).dv();
    if (!dv) {
      outputEl.createEl("em", { text: "Dataview is not available. Install and enable the Dataview plugin." });
      return;
    }

    try {
      const f = this.dashFilters;
      let allTasks = this.getAllTasks(dv);

      allTasks = this.applyDashboardFilters(allTasks, f, dv);

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
      outputEl.empty();
      const errEl = outputEl.createDiv({ cls: "pm-error" });
      errEl.style.color = "var(--text-error)";
      errEl.textContent = `pm-tasks error: ${String(err)}`;
    }
  }

  private debouncedRefresh(controlsEl: HTMLElement): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const dashboard = controlsEl.closest(".pm-tasks-dashboard");
      if (!dashboard) return;
      const outputEl = dashboard.querySelector(".pm-tasks-dashboard__output");
      if (outputEl instanceof HTMLElement) this.refreshDashboardOutput(outputEl);
    }, 200);
  }

  // ─── By-project mode ────────────────────────────────────────────────────

  private initByProjectFilters(): void {
    const cfg = this.config;
    this.byProjectFilters = {
      selectedStatuses: (cfg.selectedStatuses ?? DEFAULT_TASK_VIEW_STATUSES) as ProjectStatus[],
      projectFilter: "",
      clientFilter: [],
      engagementFilter: [],
      includeUnassignedClients: false,
      includeUnassignedEngagements: false,
      showCompleted: true,
    };
  }

  private renderByProject(): void {
    const root = this.containerEl.createDiv({ cls: "pm-tasks-by-project" });

    const controlsEl = root.createDiv({ cls: "pm-tasks-by-project__controls" });
    this.renderByProjectControls(controlsEl);

    const outputEl = root.createDiv({ cls: "pm-tasks-by-project__output" });
    this.outputEl = outputEl;
    this.refreshByProjectOutput(outputEl);
  }

  private renderByProjectControls(container: HTMLElement): void {
    const f = this.byProjectFilters;

    // Project text filter
    const filterRow = container.createDiv({ cls: "pm-tasks-control-row" });
    filterRow.createEl("label", { text: "Filter:", cls: "pm-tasks-control-row__label" });
    const filterInput = filterRow.createEl("input", {
      type: "text",
      placeholder: "Filter projects…",
      cls: "pm-tasks-search",
    });
    filterInput.setAttribute("aria-label", "Filter projects by name");
    filterInput.addEventListener("input", () => {
      f.projectFilter = filterInput.value.toLowerCase();
      this.debouncedRefreshByProject(container);
    });

    // Status multi-select
    container.createEl("label", { text: "Project Status:", cls: "pm-filter-label" });
    const statuses: ProjectStatus[] = ["New", "Active", "On Hold"];
    const statusGroup = container.createDiv({ cls: "pm-checkbox-group" });
    for (const status of statuses) {
      const label = statusGroup.createEl("label", { cls: "pm-checkbox-label" });
      const cb = label.createEl("input", { type: "checkbox" });
      cb.checked = f.selectedStatuses.includes(status);
      cb.setAttribute("aria-label", `Show ${status} projects`);
      label.createSpan({ text: status });
      cb.addEventListener("change", () => {
        if (cb.checked) f.selectedStatuses.push(status);
        else f.selectedStatuses = f.selectedStatuses.filter((s) => s !== status);
        this.debouncedRefreshByProject(container);
      });
    }

    // Show completed toggle
    const completedRow = container.createDiv({ cls: "pm-tasks-control-row" });
    completedRow.createEl("label", { text: "Show Completed:", cls: "pm-tasks-control-row__label" });
    const completedToggle = completedRow.createEl("input", { type: "checkbox" });
    completedToggle.checked = f.showCompleted;
    completedToggle.setAttribute("aria-label", "Show completed tasks");
    completedToggle.addEventListener("change", () => {
      f.showCompleted = completedToggle.checked;
      this.debouncedRefreshByProject(container);
    });
  }

  private refreshByProjectOutput(outputEl: HTMLElement): void {
    outputEl.empty();

    const dv = (this.plugin.queryService as unknown as { dv: () => import("../types").DataviewApi | null }).dv();
    if (!dv) {
      outputEl.createEl("em", { text: "Dataview is not available. Install and enable the Dataview plugin." });
      return;
    }

    try {
      const f = this.byProjectFilters;

      let projects = [...dv.pages("#project AND !\"utility\"")].filter(
        (p) => f.selectedStatuses.includes(String(p.status) as ProjectStatus)
      );

      if (f.projectFilter) {
        projects = projects.filter((p) =>
          p.file.name.toLowerCase().includes(f.projectFilter)
        );
      }

      // Sort by priority
      projects.sort((a, b) => (Number(a.priority) || 99) - (Number(b.priority) || 99));

      if (projects.length === 0) {
        outputEl.createEl("em", { text: "No projects match the current filters." });
        return;
      }

      for (const project of projects) {
        this.renderProjectTaskGroup(outputEl, project, dv, f);
      }
    } catch (err) {
      outputEl.empty();
      const errEl = outputEl.createDiv({ cls: "pm-error" });
      errEl.style.color = "var(--text-error)";
      errEl.textContent = `pm-tasks error: ${String(err)}`;
    }
  }

  private renderProjectTaskGroup(
    container: HTMLElement,
    project: DataviewPage,
    dv: import("../types").DataviewApi,
    f: ByProjectFilters
  ): void {
    const projectTasks = [...project.file.tasks];
    const incompleteTasks = projectTasks.filter((t) => !t.completed);
    const completedTasks = projectTasks.filter((t) => t.completed);

    // Get project notes
    const projectNotes = [...dv.pages()].filter(
      (p) => normalizeToName(p.relatedProject) === project.file.name
    );

    const noteIncompleteTasks: DataviewTask[] = [];
    const noteCompletedTasks: DataviewTask[] = [];
    for (const note of projectNotes) {
      noteIncompleteTasks.push(...[...note.file.tasks].filter((t) => !t.completed));
      noteCompletedTasks.push(...[...note.file.tasks].filter((t) => t.completed));
    }

    const hasIncomplete = incompleteTasks.length > 0 || noteIncompleteTasks.length > 0;
    const hasComplete = completedTasks.length > 0 || noteCompletedTasks.length > 0;

    if (!hasIncomplete && !hasComplete) return;

    const projectEl = container.createDiv({ cls: "pm-tasks-project-group" });
    projectEl.createEl("h2", {
      cls: "pm-tasks-project-group__title",
    }).innerHTML = `<a class="internal-link" data-href="${project.file.path}" href="${project.file.path}">${project.file.name}</a>`;

    if (incompleteTasks.length > 0) {
      this.renderTaskList(projectEl, incompleteTasks);
    }

    for (const note of projectNotes) {
      const noteTasks = [...note.file.tasks].filter((t) => !t.completed);
      if (noteTasks.length > 0) {
        projectEl.createEl("h3").innerHTML = `<a class="internal-link" data-href="${note.file.path}" href="${note.file.path}">${note.file.name}</a>`;
        this.renderTaskList(projectEl, noteTasks);
      }
    }

    if (f.showCompleted && hasComplete) {
      const allComplete = [...completedTasks, ...noteCompletedTasks];
      const summary = projectEl.createEl("details", { cls: "pm-tasks-completed" });
      summary.createEl("summary", {
        text: `Completed (${allComplete.length})`,
      });
      this.renderTaskList(summary, allComplete);
    }
  }

  private debouncedRefreshByProject(controlsEl: HTMLElement): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const root = controlsEl.closest(".pm-tasks-by-project");
      if (!root) return;
      const outputEl = root.querySelector(".pm-tasks-by-project__output");
      if (outputEl instanceof HTMLElement) this.refreshByProjectOutput(outputEl);
    }, 200);
  }

  /**
   * Triggered by vault 'modify' events.
   * Uses a longer debounce (1 s) to allow Dataview to re-index before re-querying.
   */
  private debouncedAutoRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      if (!this.outputEl) return;
      if (this.config?.mode === "dashboard") {
        this.refreshDashboardOutput(this.outputEl);
      } else if (this.config?.mode === "by-project") {
        this.refreshByProjectOutput(this.outputEl);
      }
    }, 1000);
  }

  // ─── Task querying and filtering ─────────────────────────────────────────

  private getAllTasks(dv: import("../types").DataviewApi): DataviewTask[] {
    const pages = [...dv.pages().where((p) => !p.file.path.startsWith("utility/"))];
    return pages.flatMap((p) => [...p.file.tasks]);
  }

  private applyDashboardFilters(
    tasks: DataviewTask[],
    f: DashboardFilters,
    dv: import("../types").DataviewApi
  ): DataviewTask[] {
    let filtered = tasks;

    if (!f.showCompleted) {
      filtered = filtered.filter((t) => !t.completed);
    }

    if (f.contextFilter.length > 0) {
      filtered = filtered.filter((t) => f.contextFilter.includes(this.getTaskContext(t)));
    }

    if (f.searchText) {
      filtered = filtered.filter((t) =>
        t.text.toLowerCase().includes(f.searchText)
      );
    }

    if (f.dueDateFilter && f.dueDateFilter !== "All") {
      filtered = filtered.filter((t) => this.matchesDueDateFilter(t, f.dueDateFilter));
    }

    if (f.priorityFilter.length > 0) {
      filtered = filtered.filter((t) =>
        f.priorityFilter.includes(this.getTaskPriority(t))
      );
    }

    if (f.clientFilter.length > 0 || f.includeUnassignedClients) {
      filtered = filtered.filter((t) =>
        this.matchesClientFilter(t, f.clientFilter, f.includeUnassignedClients, dv)
      );
    }

    if (f.engagementFilter.length > 0 || f.includeUnassignedEngagements) {
      filtered = filtered.filter((t) =>
        this.matchesEngagementFilter(t, f.engagementFilter, f.includeUnassignedEngagements, dv)
      );
    }

    if (f.viewMode === "context") {
      filtered = this.applyContextSpecificFilters(filtered, f, dv);
    }

    return filtered;
  }

  private applyContextSpecificFilters(
    tasks: DataviewTask[],
    f: DashboardFilters,
    dv: import("../types").DataviewApi
  ): DataviewTask[] {
    let filtered = tasks;

    if (f.projectStatusFilter.length > 0) {
      filtered = filtered.filter((t) => {
        if (this.getTaskContext(t) !== "Project") return true;
        const page = dv.page(t.path);
        return page !== null && f.projectStatusFilter.includes(String(page.status) as ProjectStatus);
      });
    }

    if (f.inboxStatusFilter !== "All") {
      filtered = filtered.filter((t) => {
        if (this.getTaskContext(t) !== "Inbox") return true;
        const page = dv.page(t.path);
        if (!page) return true;
        const isActive = page.status !== "Complete";
        return f.inboxStatusFilter === "Active" ? isActive : !isActive;
      });
    }

    if (f.meetingDateFilter !== "All") {
      filtered = filtered.filter((t) => {
        if (this.getTaskContext(t) !== "Meeting") return true;
        const page = dv.page(t.path);
        if (!page?.date) return f.meetingDateFilter === "All";
        return this.matchesMeetingDateFilter(String(page.date), f.meetingDateFilter);
      });
    }

    return filtered;
  }

  // ─── Context rendering ────────────────────────────────────────────────────

  private renderByContext(
    container: HTMLElement,
    tasks: DataviewTask[],
    f: DashboardFilters,
    dv: import("../types").DataviewApi
  ): void {
    const allContexts: TaskContext[] = [
      "Project",
      "Person",
      "Meeting",
      "Inbox",
      "Daily Notes",
      "Other",
    ];

    for (const context of allContexts) {
      const ctxTasks = tasks.filter((t) => this.getTaskContext(t) === context);
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
        .sort((a, b) => {
          return this.compareGroups(a.tasks, b.tasks, f.sortBy);
        });

      for (const { filePath, tasks: fileTasks } of fileGroups) {
        const page = dv.page(filePath);
        const name = page?.file.name ?? filePath;
        container.createEl("h3").innerHTML = `<a class="internal-link" data-href="${filePath}" href="${filePath}">${name}</a>`;

        if (context === "Project" && projectNoteMapping[filePath]) {
          // Direct project tasks first
          const directTasks = fileTasks.filter((t) => t.link.path === filePath);
          if (directTasks.length > 0) {
            this.renderTaskList(container, this.sortTasks(directTasks, f.sortBy));
          }
          // Then note sub-sections
          for (const [notePath, noteTasks] of Object.entries(projectNoteMapping[filePath])) {
            const notePage = dv.page(notePath);
            const noteName = notePage?.file.name ?? notePath;
            container.createEl("h4").innerHTML = `<a class="internal-link" data-href="${notePath}" href="${notePath}">${noteName}</a>`;
            this.renderTaskList(container, this.sortTasks(noteTasks, f.sortBy));
          }
        } else {
          this.renderTaskList(container, this.sortTasks(fileTasks, f.sortBy));
        }
      }
    }
  }

  // ─── Date rendering ───────────────────────────────────────────────────────

  private renderByDate(container: HTMLElement, tasks: DataviewTask[], f: DashboardFilters): void {
    const today = todayISO();
    const tomorrow = this.addDays(today, 1);
    const weekEnd = this.addDays(today, 7);

    const overdue = tasks.filter((t) => t.due && String(t.due).substring(0, 10) < today);
    const todayTasks = tasks.filter((t) => t.due && String(t.due).substring(0, 10) === today);
    const tomorrowTasks = tasks.filter((t) => t.due && String(t.due).substring(0, 10) === tomorrow);
    const thisWeek = tasks.filter((t) => {
      if (!t.due) return false;
      const d = String(t.due).substring(0, 10);
      return d > tomorrow && d <= weekEnd;
    });
    const upcoming = tasks.filter((t) => t.due && String(t.due).substring(0, 10) > weekEnd);
    const noDue = tasks.filter((t) => !t.due);

    if (overdue.length > 0) {
      container.createEl("h2", { text: "⚠️ Overdue" });
      this.renderTaskList(container, this.sortTasks(overdue, f.sortBy || "dueDate-asc"));
    }
    if (todayTasks.length > 0) {
      container.createEl("h2", { text: "📅 Today" });
      this.renderTaskList(container, this.sortTasks(todayTasks, f.sortBy || "priority-asc"));
    }
    if (tomorrowTasks.length > 0) {
      container.createEl("h2", { text: "📆 Tomorrow" });
      this.renderTaskList(container, this.sortTasks(tomorrowTasks, f.sortBy || "priority-asc"));
    }
    if (thisWeek.length > 0) {
      container.createEl("h2", { text: "📋 This Week" });
      this.renderTaskList(container, this.sortTasks(thisWeek, f.sortBy || "dueDate-asc"));
    }
    if (upcoming.length > 0) {
      container.createEl("h2", { text: "🔮 Upcoming" });
      this.renderTaskList(container, this.sortTasks(upcoming, f.sortBy || "dueDate-asc"));
    }
    if (noDue.length > 0) {
      container.createEl("h2", { text: "📝 No Due Date" });
      this.renderTaskList(container, this.sortTasks(noDue, f.sortBy || "priority-asc"));
    }
  }

  // ─── Priority rendering ───────────────────────────────────────────────────

  private renderByPriority(container: HTMLElement, tasks: DataviewTask[], f: DashboardFilters): void {
    for (let priority = 1; priority <= 5; priority++) {
      const priTasks = tasks.filter((t) => this.getTaskPriority(t) === priority);
      if (priTasks.length === 0) continue;
      container.createEl("h2", { text: PRIORITY_DISPLAY[priority] });
      this.renderTaskList(container, this.sortTasks(priTasks, f.sortBy));
    }
  }

  // ─── Tag rendering ────────────────────────────────────────────────────────

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
      this.renderTaskList(container, this.sortTasks(tagMap[tag], f.sortBy));
    }

    if (untagged.length > 0) {
      container.createEl("h2", { text: "📌 Untagged" });
      this.renderTaskList(container, this.sortTasks(untagged, f.sortBy));
    }
  }

  // ─── Task list rendering ──────────────────────────────────────────────────

  private renderTaskList(container: HTMLElement, tasks: DataviewTask[]): void {
    const ul = container.createEl("ul", { cls: "pm-task-list contains-task-list" });

    for (const task of tasks) {
      const li = ul.createEl("li", { cls: "task-list-item" });

      const checkbox = li.createEl("input", {
        type: "checkbox",
        cls: "task-list-item-checkbox",
      });
      checkbox.checked = task.completed;
      const ariaPrefix = task.completed ? "Mark incomplete: " : "Mark complete: ";
      checkbox.setAttribute("aria-label", ariaPrefix + this.cleanTaskText(task.text).substring(0, 60));

      checkbox.addEventListener("change", () => {
        void this.toggleTask(task, checkbox.checked);
      });

      const textSpan = li.createSpan({ cls: "pm-task-text" });
      textSpan.setText(this.cleanTaskText(task.text));

      // Due date badge
      const dueDate = this.extractEmojiDate(task.text, DUE_DATE_EMOJI);
      if (dueDate) {
        const badge = li.createSpan({ cls: "pm-task-due" });
        badge.textContent = `📅 ${dueDate}`;
        if (dueDate < todayISO()) badge.classList.add("pm-task-due--overdue");
      }

      // Priority badge
      const priority = this.getTaskPriority(task);
      if (priority !== 3) {
        const priorityEmoji = Object.entries(PRIORITY_EMOJI).find(([, p]) => p === priority)?.[0];
        if (priorityEmoji) {
          li.createSpan({ cls: "pm-task-priority", text: priorityEmoji });
        }
      }

      // Source file link
      const sourceLink = li.createEl("a", {
        cls: "pm-task-source internal-link",
        href: task.link.path,
      });
      sourceLink.dataset.href = task.link.path;
      const page = this.plugin.queryService.getPage(task.link.path);
      sourceLink.textContent = page?.file.name ?? task.link.path;
    }
  }

  private async toggleTask(task: DataviewTask, nowCompleted: boolean): Promise<void> {
    const file = this.plugin.app.vault.getAbstractFileByPath(task.path);
    if (!(file instanceof TFile)) return;

    const content = await this.plugin.app.vault.read(file);
    const lines = content.split("\n");
    const lineIndex = task.line;

    if (lineIndex >= lines.length) return;

    const originalLine = lines[lineIndex];
    lines[lineIndex] = this.plugin.taskParser.toggleTaskLine(originalLine, nowCompleted);
    await this.plugin.app.vault.modify(file, lines.join("\n"));
  }

  // ─── Filter helpers ───────────────────────────────────────────────────────

  private matchesDueDateFilter(task: DataviewTask, filter: DueDateFilter): boolean {
    const today = todayISO();
    const weekEnd = this.addDays(today, 7);
    const due = task.due ? String(task.due).substring(0, 10) : null;

    switch (filter) {
      case "Today":
        return due === today;
      case "This Week":
        return due !== null && due >= today && due <= weekEnd;
      case "Overdue":
        return due !== null && due < today;
      case "No Date":
        return due === null;
      default:
        return true;
    }
  }

  private matchesMeetingDateFilter(dateStr: string, filter: MeetingDateFilter): boolean {
    const today = todayISO();
    const weekEnd = this.addDays(today, 7);
    const d = dateStr.substring(0, 10);

    switch (filter) {
      case "Today":
        return d === today;
      case "This Week":
        return d >= today && d <= weekEnd;
      case "Past":
        return d < today;
      default:
        return true;
    }
  }

  private matchesClientFilter(
    task: DataviewTask,
    clientFilter: string[],
    includeUnassigned: boolean,
    dv: import("../types").DataviewApi
  ): boolean {
    if (clientFilter.length === 0 && !includeUnassigned) return true;

    const page = dv.page(task.path);
    if (!page) return false;

    let taskClient = normalizeToName(page.client);

    if (!taskClient && page.engagement) {
      taskClient = this.plugin.queryService.getClientFromEngagementLink(page.engagement);
    }

    if (!taskClient && page.relatedProject) {
      const parentProjectName = normalizeToName(page.relatedProject);
      if (parentProjectName) {
        const parentProject = dv.page(`projects/${parentProjectName}`);
        if (parentProject) {
          taskClient = normalizeToName(parentProject.client);
          if (!taskClient && parentProject.engagement) {
            taskClient = this.plugin.queryService.getClientFromEngagementLink(
              parentProject.engagement
            );
          }
        }
      }
    }

    if (includeUnassigned && !taskClient) return true;
    if (clientFilter.length === 0) return includeUnassigned ? !taskClient : false;
    return taskClient !== null && clientFilter.includes(taskClient);
  }

  private matchesEngagementFilter(
    task: DataviewTask,
    engagementFilter: string[],
    includeUnassigned: boolean,
    dv: import("../types").DataviewApi
  ): boolean {
    if (engagementFilter.length === 0 && !includeUnassigned) return true;

    const page = dv.page(task.path);
    if (!page) return false;

    let taskEngagement = normalizeToName(page.engagement);

    if (!taskEngagement && page.relatedProject) {
      const parentProjectName = normalizeToName(page.relatedProject);
      if (parentProjectName) {
        const parentProject = dv.page(`projects/${parentProjectName}`);
        if (parentProject) {
          taskEngagement = normalizeToName(parentProject.engagement);
        }
      }
    }

    if (includeUnassigned && !taskEngagement) return true;
    if (engagementFilter.length === 0) return includeUnassigned ? !taskEngagement : false;
    return taskEngagement !== null && engagementFilter.includes(taskEngagement);
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private getTaskContext(task: DataviewTask): TaskContext {
    const path = task.path;
    if (path.startsWith("projects/")) return "Project";
    if (path.startsWith("people/")) return "Person";
    if (path.startsWith("meetings/")) return "Meeting";
    if (path.startsWith("inbox/")) return "Inbox";
    if (path.startsWith("daily notes/")) return "Daily Notes";
    return "Other";
  }

  private getTaskPriority(task: DataviewTask): TaskPriority {
    const text = task.text ?? "";
    for (const [emoji, priority] of Object.entries(PRIORITY_EMOJI)) {
      if (text.includes(emoji)) return priority as TaskPriority;
    }
    return 3;
  }

  private getParentProjectPath(
    filePath: string,
    dv: import("../types").DataviewApi
  ): string | null {
    const page = dv.page(filePath);
    if (!page?.relatedProject) return null;
    const projectName = normalizeToName(page.relatedProject);
    if (!projectName) return null;
    return `projects/${projectName}.md`;
  }

  private sortTasks(tasks: DataviewTask[], sortBy: SortBy): DataviewTask[] {
    if (sortBy === "none") return tasks;
    const isDesc = sortBy.endsWith("-desc");

    if (sortBy.startsWith("dueDate")) {
      return [...tasks].sort((a, b) => {
        const aDate = a.due ? String(a.due).substring(0, 10) : (isDesc ? "0000-00-00" : "9999-99-99");
        const bDate = b.due ? String(b.due).substring(0, 10) : (isDesc ? "0000-00-00" : "9999-99-99");
        return isDesc ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
      });
    }

    if (sortBy.startsWith("priority")) {
      return [...tasks].sort((a, b) => {
        const ap = this.getTaskPriority(a);
        const bp = this.getTaskPriority(b);
        return isDesc ? bp - ap : ap - bp;
      });
    }

    return tasks;
  }

  private compareGroups(aTasks: DataviewTask[], bTasks: DataviewTask[], sortBy: SortBy): number {
    if (sortBy === "none") return 0;
    const isDesc = sortBy.endsWith("-desc");

    if (sortBy.startsWith("dueDate")) {
      const aBest = aTasks
        .filter((t) => t.due)
        .map((t) => String(t.due).substring(0, 10))
        .sort()[isDesc ? "pop" : "shift"]?.();
      const bBest = bTasks
        .filter((t) => t.due)
        .map((t) => String(t.due).substring(0, 10))
        .sort()[isDesc ? "pop" : "shift"]?.();
      const aKey = aBest ?? (isDesc ? "0000-00-00" : "9999-99-99");
      const bKey = bBest ?? (isDesc ? "0000-00-00" : "9999-99-99");
      return isDesc ? bKey.localeCompare(aKey) : aKey.localeCompare(bKey);
    }

    if (sortBy.startsWith("priority")) {
      const aMin = Math.min(...aTasks.map((t) => this.getTaskPriority(t)));
      const bMin = Math.min(...bTasks.map((t) => this.getTaskPriority(t)));
      return isDesc ? bMin - aMin : aMin - bMin;
    }

    return 0;
  }

  private extractEmojiDate(text: string, emoji: string): string | null {
    const idx = text.indexOf(emoji);
    if (idx === -1) return null;
    const rest = text.substring(idx + emoji.length).trim();
    const match = rest.match(/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }

  /** Strips emoji metadata from task text for clean display. */
  private cleanTaskText(text: string): string {
    return text
      .replace(/[⏫🔼🔽⏬]/gu, "")
      .replace(/📅\s*\d{4}-\d{2}-\d{2}/gu, "")
      .replace(/✅\s*\d{4}-\d{2}-\d{2}/gu, "")
      .replace(/🔁[^📅✅⏫🔼🔽⏬]*/gu, "")
      .trim();
  }

  private addDays(isoDate: string, days: number): string {
    const d = new Date(isoDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }

  private createSelect(
    container: HTMLElement,
    values: string[],
    labels: Record<string, string>
  ): HTMLSelectElement {
    const select = container.createEl("select", { cls: "pm-tasks-filter-select dropdown" });
    for (const v of values) {
      select.createEl("option", { text: labels[v] ?? v, value: v });
    }
    return select;
  }

  private renderCollapsible(
    container: HTMLElement,
    title: string,
    renderFn: (inner: HTMLElement) => void
  ): void {
    const details = container.createEl("details", { cls: "pm-filter-section" });
    details.createEl("summary", { text: title, cls: "pm-filter-section__title" });
    const inner = details.createDiv({ cls: "pm-filter-section__content" });
    renderFn(inner);
  }

  private renderError(message: string): void {
    const div = this.containerEl.createDiv({ cls: "pm-error" });
    div.style.color = "var(--text-error)";
    div.textContent = message;
  }
}
