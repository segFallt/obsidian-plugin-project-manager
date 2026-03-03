import { MarkdownRenderChild, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type { PluginServices, RegisterProcessorFn } from "../plugin-context";
import type { PmTasksConfig } from "../types";
import { TaskFilterService } from "../services/task-filter-service";
import { TaskSortService } from "../services/task-sort-service";
import { TaskListRenderer } from "./task-list-renderer";
import { DashboardView } from "./pm-tasks-dashboard";
import { ByProjectView } from "./pm-tasks-by-project";
import { renderError } from "./dom-helpers";

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
export function registerPmTasksProcessor(
  services: PluginServices,
  registerProcessor: RegisterProcessorFn
): void {
  registerProcessor("pm-tasks", (source, el, ctx: MarkdownPostProcessorContext) => {
    const child = new PmTasksRenderChild(el, source, services);
    ctx.addChild(child);
    child.render();
  });
}

// ─── Render child ──────────────────────────────────────────────────────────

class PmTasksRenderChild extends MarkdownRenderChild {
  private config!: PmTasksConfig;
  private activeView: DashboardView | ByProjectView | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly services: PluginServices
  ) {
    super(containerEl);
  }

  onload(): void {
    // Auto-refresh task output when any vault file is modified.
    // Uses a 1 second debounce to allow Dataview to re-index before querying.
    this.registerEvent(
      this.services.app.vault.on("modify", () => {
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
      renderError(this.containerEl, "Invalid pm-tasks config.");
      return;
    }

    if (!this.config?.mode) {
      renderError(this.containerEl, "pm-tasks requires a `mode` field (dashboard or by-project).");
      return;
    }

    const filterService = new TaskFilterService();
    const sortService = new TaskSortService();
    const renderer = new TaskListRenderer(this.services);

    if (this.config.mode === "dashboard") {
      this.activeView = new DashboardView(
        this.containerEl,
        this.config,
        this.services,
        filterService,
        sortService,
        renderer
      );
      this.activeView.render();
    } else if (this.config.mode === "by-project") {
      this.activeView = new ByProjectView(
        this.containerEl,
        this.config,
        this.services,
        sortService,
        renderer
      );
      this.activeView.render();
    } else {
      renderError(this.containerEl, `Unknown pm-tasks mode: ${String(this.config.mode)}`);
    }
  }

  /**
   * Triggered by vault 'modify' events.
   * Uses a longer debounce (1 s) to allow Dataview to re-index before re-querying.
   */
  private debouncedAutoRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.activeView?.refreshOutput();
    }, 1000);
  }
}
