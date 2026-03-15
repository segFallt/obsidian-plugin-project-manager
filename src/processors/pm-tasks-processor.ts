import { MarkdownRenderChild, TFile, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type { TaskProcessorServices, RegisterProcessorFn } from "../plugin-context";
import type { PmTasksConfig, SavedDashboardFilters, SavedByProjectFilters } from "../types";
import { TaskListRenderer } from "./task-list-renderer";
import { DashboardView } from "./pm-tasks-dashboard";
import { ByProjectView } from "./pm-tasks-by-project";
import { renderError } from "./dom-helpers";
import { DEBOUNCE_MS, CODEBLOCK } from "../constants";

// ─── Module-level filter state cache ───────────────────────────────────────
// Stores filter state synchronously when the user changes a filter, so a
// newly-recreated widget can restore the correct active state even before
// Obsidian's metadataCache has indexed the freshly-written frontmatter.

const filterStateCache = new Map<string, SavedDashboardFilters | SavedByProjectFilters>();

export function _clearFilterStateCacheForTests(): void {
  filterStateCache.clear();
}

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
 * Filter state is persisted to the note's frontmatter under the `pm-tasks-filters` key.
 */
export function registerPmTasksProcessor(
  services: TaskProcessorServices,
  registerProcessor: RegisterProcessorFn
): void {
  registerProcessor(CODEBLOCK.PM_TASKS, (source, el, ctx: MarkdownPostProcessorContext) => {
    const child = new PmTasksRenderChild(el, source, ctx.sourcePath, services);
    ctx.addChild(child);
    child.render();
  });
}

// ─── Render child ──────────────────────────────────────────────────────────

const FILTER_FM_KEY = "pm-tasks-filters";

class PmTasksRenderChild extends MarkdownRenderChild {
  private config!: PmTasksConfig;
  private activeView: DashboardView | ByProjectView | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isUpdating = false;

  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly sourcePath: string,
    private readonly services: TaskProcessorServices
  ) {
    super(containerEl);
  }

  onload(): void {
    // Auto-refresh task output when any vault file is modified.
    // Uses a 1 second debounce to allow Dataview to re-index before querying.
    this.registerEvent(
      this.services.app.vault.on("modify", () => {
        if (!this.isUpdating) this.debouncedAutoRefresh();
      })
    );
  }

  onunload(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.saveDebounceTimer !== null) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
    }
  }

  render(): void {
    this.containerEl.empty();

    try {
      this.config = parseYaml(this.source) as PmTasksConfig;
    } catch {
      const msg = "Invalid pm-tasks config.";
      this.services.loggerService.warn(msg, "pm-tasks-processor");
      renderError(this.containerEl, msg);
      return;
    }

    if (!this.config?.mode) {
      const msg = "pm-tasks requires a `mode` field (dashboard or by-project).";
      this.services.loggerService.warn(msg, "pm-tasks-processor");
      renderError(this.containerEl, msg);
      return;
    }

    const filterService = this.services.filterService;
    const sortService = this.services.sortService;
    const renderer = new TaskListRenderer(this.services);
    const savedFilters = this.loadSavedFilters();

    if (this.config.mode === "dashboard") {
      this.activeView = new DashboardView(
        this.containerEl,
        this.config,
        this.services,
        filterService,
        sortService,
        renderer,
        savedFilters as SavedDashboardFilters | null,
        (filters) => this.debouncedSaveFilters(filters)
      );
      this.activeView.render();
    } else if (this.config.mode === "by-project") {
      this.activeView = new ByProjectView(
        this.containerEl,
        this.config,
        this.services,
        sortService,
        renderer,
        savedFilters as SavedByProjectFilters | null,
        (filters) => this.debouncedSaveFilters(filters)
      );
      this.activeView.render();
    } else {
      const msg = `Unknown pm-tasks mode: ${String(this.config.mode)}`;
      this.services.loggerService.warn(msg, "pm-tasks-processor");
      renderError(this.containerEl, msg);
    }
  }

  private loadSavedFilters(): unknown {
    // Check in-memory cache first — it's updated synchronously when the user
    // changes a filter, so it remains accurate even when metadataCache is stale
    // (e.g. immediately after a frontmatter write that recreated the widget).
    const cached = filterStateCache.get(this.sourcePath);
    if (cached) return cached;
    const file = this.services.app.vault.getAbstractFileByPath(this.sourcePath);
    if (!(file instanceof TFile)) return null;
    return this.services.app.metadataCache.getFileCache(file)?.frontmatter?.[FILTER_FM_KEY] ?? null;
  }

  private debouncedSaveFilters(filters: SavedDashboardFilters | SavedByProjectFilters | null): void {
    // Update the in-memory cache synchronously so a widget recreation that
    // happens before the debounced frontmatter write still reads the correct state.
    if (filters === null) {
      filterStateCache.delete(this.sourcePath);
    } else {
      filterStateCache.set(this.sourcePath, filters);
    }
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      void this.persistFilters(filters);
    }, DEBOUNCE_MS.PROPERTIES);
  }

  private async persistFilters(filters: SavedDashboardFilters | SavedByProjectFilters | null): Promise<void> {
    const file = this.services.app.vault.getAbstractFileByPath(this.sourcePath);
    if (!(file instanceof TFile)) return;
    this.isUpdating = true;
    try {
      await this.services.app.fileManager.processFrontMatter(
        file,
        (fm: Record<string, unknown>) => {
          if (filters === null) {
            delete fm[FILTER_FM_KEY];
          } else {
            fm[FILTER_FM_KEY] = filters;
          }
        }
      );
    } finally {
      this.isUpdating = false;
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
    }, DEBOUNCE_MS.TASKS);
  }
}
