import { TFile } from "obsidian";
import type { TaskProcessorServices } from "../plugin-context";
import type {
  PmTasksConfig,
  DataviewTask,
  ByProjectFilters,
  SavedByProjectFilters,
  ProjectStatus,
} from "../types";
import { DEFAULT_TASK_VIEW_STATUSES, PRIORITY_FALLBACK, DEBOUNCE_MS, ENTITY_TAGS, CSS_CLS, MSG, LOG_CONTEXT } from "../constants";
import { renderError } from "./dom-helpers";
import { normalizeToName } from "../utils/link-utils";
import type { ITaskSortService } from "../services/interfaces";
import type { TaskListRenderer } from "./task-list-renderer";
import { FilterChipSelect } from "../ui/components/filter-chip-select";

/**
 * Renders the by-project mode: project list with filter controls and per-project task groups.
 */
export class ByProjectView {
  private filters!: ByProjectFilters;
  private outputEl!: HTMLElement;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private chipSelects: FilterChipSelect[] = [];

  constructor(
    private readonly containerEl: HTMLElement,
    private readonly config: PmTasksConfig,
    private readonly services: TaskProcessorServices,
    private readonly sortService: ITaskSortService,
    private readonly renderer: TaskListRenderer,
    private readonly savedFilters?: SavedByProjectFilters | null,
    private readonly onSaveFilters?: ((filters: SavedByProjectFilters | null) => void) | null
  ) {}

  render(): void {
    this.services.loggerService.debug(`pm-tasks-by-project rendering, mode: "${this.config.mode}"`, LOG_CONTEXT.TASKS_BY_PROJECT);
    this.initFilters();
    const root = this.containerEl.createDiv({ cls: "pm-tasks-by-project" });
    const controlsEl = root.createDiv({ cls: "pm-tasks-by-project__controls" });
    this.renderControls(controlsEl);
    this.outputEl = root.createDiv({ cls: "pm-tasks-by-project__output" });
    void this.refreshByProjectOutput(this.outputEl);
  }

  refreshOutput(): void {
    if (this.outputEl) void this.refreshByProjectOutput(this.outputEl);
  }

  // ─── Filter initialisation ────────────────────────────────────────────────

  private initFilters(): void {
    const cfg = this.config;
    const saved = this.savedFilters;
    this.filters = {
      selectedStatuses: saved?.selectedStatuses ?? (cfg.selectedStatuses ?? DEFAULT_TASK_VIEW_STATUSES) as ProjectStatus[],
      projectFilter: "",
      clientFilter: saved?.clientFilter ?? [],
      engagementFilter: saved?.engagementFilter ?? [],
      includeUnassignedClients: saved?.includeUnassignedClients ?? false,
      includeUnassignedEngagements: saved?.includeUnassignedEngagements ?? false,
      showCompleted: saved?.showCompleted ?? true,
    };
  }

  private persistFilters(): void {
    if (!this.onSaveFilters) return;
    const f = this.filters;
    const toSave: SavedByProjectFilters = {
      selectedStatuses: f.selectedStatuses,
      clientFilter: f.clientFilter,
      engagementFilter: f.engagementFilter,
      includeUnassignedClients: f.includeUnassignedClients,
      includeUnassignedEngagements: f.includeUnassignedEngagements,
      showCompleted: f.showCompleted,
    };
    this.onSaveFilters(toSave);
  }

  // ─── Controls rendering ───────────────────────────────────────────────────

  private renderControls(container: HTMLElement): void {
    const f = this.filters;

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
    const statuses: ProjectStatus[] = [...DEFAULT_TASK_VIEW_STATUSES] as ProjectStatus[];
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
        this.persistFilters();
        this.debouncedRefreshByProject(container);
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
          unassignedLabel: "Include projects without client",
          onChange: (values, includeUnassigned) => {
            f.clientFilter = values;
            f.includeUnassignedClients = includeUnassigned;
            this.persistFilters();
            this.debouncedRefreshByProject(container);
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
          unassignedLabel: "Include projects without engagement",
          onChange: (values, includeUnassigned) => {
            f.engagementFilter = values;
            f.includeUnassignedEngagements = includeUnassigned;
            this.persistFilters();
            this.debouncedRefreshByProject(container);
          },
        }
      );
      this.chipSelects.push(engChipSelect);
    }

    // Show completed toggle
    const completedRow = container.createDiv({ cls: "pm-tasks-control-row" });
    completedRow.createEl("label", { text: "Show Completed:", cls: "pm-tasks-control-row__label" });
    const completedToggle = completedRow.createEl("input", { type: "checkbox" });
    completedToggle.checked = f.showCompleted;
    completedToggle.setAttribute("aria-label", "Show completed tasks");
    completedToggle.addEventListener("change", () => {
      f.showCompleted = completedToggle.checked;
      this.persistFilters();
      this.debouncedRefreshByProject(container);
    });
  }

  // ─── Output rendering ─────────────────────────────────────────────────────

  private async refreshByProjectOutput(outputEl: HTMLElement): Promise<void> {
    outputEl.empty();

    const dv = this.services.queryService.dv();
    if (!dv) {
      outputEl.createEl("em", { text: MSG.DATAVIEW_UNAVAILABLE });
      return;
    }

    try {
      const f = this.filters;

      let projects = [...dv.pages(`#project AND !"${this.services.settings.folders.utility}"`)].filter(
        (p) => f.selectedStatuses.includes(String(p.status) as ProjectStatus)
      );

      if (f.projectFilter) {
        projects = projects.filter((p) =>
          p.file.name.toLowerCase().includes(f.projectFilter)
        );
      }

      // Client filter
      if (f.clientFilter.length > 0 || f.includeUnassignedClients) {
        projects = projects.filter((p) => {
          const client = normalizeToName(p.client);
          if (!client) return f.includeUnassignedClients;
          return f.clientFilter.length === 0 || f.clientFilter.includes(client);
        });
      }

      // Engagement filter
      if (f.engagementFilter.length > 0 || f.includeUnassignedEngagements) {
        projects = projects.filter((p) => {
          const engagement = normalizeToName(p.engagement);
          if (!engagement) return f.includeUnassignedEngagements;
          return f.engagementFilter.length === 0 || f.engagementFilter.includes(engagement);
        });
      }

      // Sort by priority
      projects.sort((a, b) => (Number(a.priority) || PRIORITY_FALLBACK) - (Number(b.priority) || PRIORITY_FALLBACK));

      if (projects.length === 0) {
        outputEl.createEl("em", { text: "No projects match the current filters." });
        return;
      }

      for (const project of projects) {
        await this.renderProjectTaskGroup(outputEl, project, f);
      }
    } catch (err) {
      this.services.loggerService.error(String(err), LOG_CONTEXT.TASKS_BY_PROJECT, err);
      outputEl.empty();
      renderError(outputEl, `pm-tasks error: ${String(err)}`);
    }
  }

  /** Releases all FilterChipSelect instances. Call before a full re-render. */
  destroyChipSelects(): void {
    for (const cs of this.chipSelects) cs.destroy();
    this.chipSelects = [];
  }

  private async renderProjectTaskGroup(
    container: HTMLElement,
    project: import("../types").DataviewPage,
    f: ByProjectFilters
  ): Promise<void> {
    const projectTasks = [...project.file.tasks];
    const incompleteTasks = projectTasks.filter((t) => !t.completed);
    const completedTasks = projectTasks.filter((t) => t.completed);

    // Get project notes via queryService (DIP-compliant)
    const projectTFile = this.services.app.vault.getAbstractFileByPath(project.file.path);
    const projectNotes = projectTFile instanceof TFile
      ? this.services.queryService.getProjectNotes(projectTFile)
      : [];

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
    }).innerHTML = `<a class="${CSS_CLS.INTERNAL_LINK}" data-href="${project.file.path}" href="${project.file.path}">${project.file.name}</a>`;

    if (incompleteTasks.length > 0) {
      await this.renderer.renderTaskList(projectEl, incompleteTasks);
    }

    for (const note of projectNotes) {
      const noteTasks = [...note.file.tasks].filter((t) => !t.completed);
      if (noteTasks.length > 0) {
        projectEl.createEl("h3").innerHTML = `<a class="${CSS_CLS.INTERNAL_LINK}" data-href="${note.file.path}" href="${note.file.path}">${note.file.name}</a>`;
        await this.renderer.renderTaskList(projectEl, noteTasks);
      }
    }

    if (f.showCompleted && hasComplete) {
      const allComplete = [...completedTasks, ...noteCompletedTasks];
      const summary = projectEl.createEl("details", { cls: "pm-tasks-completed" });
      summary.createEl("summary", {
        text: `Completed (${allComplete.length})`,
      });
      await this.renderer.renderTaskList(summary, allComplete);
    }
  }

  private debouncedRefreshByProject(controlsEl: HTMLElement): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      const root = controlsEl.closest(".pm-tasks-by-project");
      if (!root) return;
      const outputEl = root.querySelector(".pm-tasks-by-project__output");
      if (outputEl instanceof HTMLElement) void this.refreshByProjectOutput(outputEl);
    }, DEBOUNCE_MS.SEARCH);
  }
}
