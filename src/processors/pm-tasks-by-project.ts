import type { PluginServices } from "../plugin-context";
import type {
  PmTasksConfig,
  DataviewApi,
  DataviewTask,
  ByProjectFilters,
  ProjectStatus,
} from "../types";
import { DEFAULT_TASK_VIEW_STATUSES } from "../constants";
import { normalizeToName } from "../utils/link-utils";
import type { ITaskSortService } from "../services/interfaces";
import type { TaskListRenderer } from "./task-list-renderer";

/**
 * Renders the by-project mode: project list with filter controls and per-project task groups.
 */
export class ByProjectView {
  private filters!: ByProjectFilters;
  private outputEl!: HTMLElement;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly containerEl: HTMLElement,
    private readonly config: PmTasksConfig,
    private readonly services: PluginServices,
    private readonly sortService: ITaskSortService,
    private readonly renderer: TaskListRenderer
  ) {}

  render(): void {
    this.initFilters();
    const root = this.containerEl.createDiv({ cls: "pm-tasks-by-project" });
    const controlsEl = root.createDiv({ cls: "pm-tasks-by-project__controls" });
    this.renderControls(controlsEl);
    this.outputEl = root.createDiv({ cls: "pm-tasks-by-project__output" });
    this.refreshByProjectOutput(this.outputEl);
  }

  refreshOutput(): void {
    if (this.outputEl) this.refreshByProjectOutput(this.outputEl);
  }

  // ─── Filter initialisation ────────────────────────────────────────────────

  private initFilters(): void {
    const cfg = this.config;
    this.filters = {
      selectedStatuses: (cfg.selectedStatuses ?? DEFAULT_TASK_VIEW_STATUSES) as ProjectStatus[],
      projectFilter: "",
      clientFilter: [],
      engagementFilter: [],
      includeUnassignedClients: false,
      includeUnassignedEngagements: false,
      showCompleted: true,
    };
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

  // ─── Output rendering ─────────────────────────────────────────────────────

  private refreshByProjectOutput(outputEl: HTMLElement): void {
    outputEl.empty();

    const dv = this.services.queryService.dv();
    if (!dv) {
      outputEl.createEl("em", { text: "Dataview is not available. Install and enable the Dataview plugin." });
      return;
    }

    try {
      const f = this.filters;

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
    project: import("../types").DataviewPage,
    dv: DataviewApi,
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
      this.renderer.renderTaskList(projectEl, incompleteTasks);
    }

    for (const note of projectNotes) {
      const noteTasks = [...note.file.tasks].filter((t) => !t.completed);
      if (noteTasks.length > 0) {
        projectEl.createEl("h3").innerHTML = `<a class="internal-link" data-href="${note.file.path}" href="${note.file.path}">${note.file.name}</a>`;
        this.renderer.renderTaskList(projectEl, noteTasks);
      }
    }

    if (f.showCompleted && hasComplete) {
      const allComplete = [...completedTasks, ...noteCompletedTasks];
      const summary = projectEl.createEl("details", { cls: "pm-tasks-completed" });
      summary.createEl("summary", {
        text: `Completed (${allComplete.length})`,
      });
      this.renderer.renderTaskList(summary, allComplete);
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
}
