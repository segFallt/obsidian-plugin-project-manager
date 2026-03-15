import { App, MarkdownRenderChild, TAbstractFile, TFile, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type { TaskProcessorServices, RegisterProcessorFn } from "../plugin-context";
import type { PmTasksConfig, SavedDashboardFilters, SavedByProjectFilters } from "../types";
import { TaskListRenderer } from "./task-list-renderer";
import { DashboardView } from "./pm-tasks-dashboard";
import { ByProjectView } from "./pm-tasks-by-project";
import { renderError } from "./dom-helpers";
import { DEBOUNCE_MS, CODEBLOCK } from "../constants";

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
 * Filter state is held in the module-level cache during the session and flushed
 * to the note's frontmatter on plugin unload (via flushFilterStateCache).
 */

const FILTER_FM_KEY = "pm-tasks-filters";

/**
 * In-memory cache keyed by sourcePath. Updated synchronously in debouncedSaveFilters
 * so that re-renders always load fresh filter state without writing to the source note
 * (which would trigger a widget destroy/rebuild flash in Obsidian's Live Preview).
 */
const filterStateCache = new Map<string, SavedDashboardFilters | SavedByProjectFilters>();

/** @internal Exposed for unit tests only — clears all cached filter state. */
export function _clearFilterStateCacheForTests(): void {
  filterStateCache.clear();
}

/**
 * Flushes in-memory filter state to each note's frontmatter.
 * Call this from the plugin's onunload() for cross-session persistence.
 */
export async function flushFilterStateCache(app: App): Promise<void> {
  for (const [sourcePath, filters] of filterStateCache.entries()) {
    const file = app.vault.getAbstractFileByPath(sourcePath);
    if (!(file instanceof TFile)) continue;
    try {
      await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        fm[FILTER_FM_KEY] = filters;
      });
    } catch {
      // Best-effort — file may have been deleted/moved
    }
  }
}

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

class PmTasksRenderChild extends MarkdownRenderChild {
  private config!: PmTasksConfig;
  private activeView: DashboardView | ByProjectView | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly sourcePath: string,
    private readonly services: TaskProcessorServices
  ) {
    super(containerEl);
  }

  onload(): void {
    // Auto-refresh task output when other vault files are modified.
    // Ignores modifications to the source note itself (e.g. from flushFilterStateCache
    // on plugin unload) to avoid spurious refreshes.
    // Uses a 1 second debounce to allow Dataview to re-index before querying.
    this.registerEvent(
      this.services.app.vault.on("modify", (file: TAbstractFile) => {
        if (file.path !== this.sourcePath) {
          this.debouncedAutoRefresh();
        }
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
    // Prefer in-memory cache (always current) over metadataCache (may be stale).
    const cached = filterStateCache.get(this.sourcePath);
    if (cached) return cached;
    const file = this.services.app.vault.getAbstractFileByPath(this.sourcePath);
    if (!(file instanceof TFile)) return null;
    return this.services.app.metadataCache.getFileCache(file)?.frontmatter?.[FILTER_FM_KEY] ?? null;
  }

  private debouncedSaveFilters(filters: SavedDashboardFilters | SavedByProjectFilters | null): void {
    // Update in-memory cache only — no frontmatter write during the session.
    // Writing to the source note triggers widget destroy/rebuild in Live Preview,
    // causing a visible flash. Persistence happens on plugin unload via flushFilterStateCache.
    if (filters !== null) {
      filterStateCache.set(this.sourcePath, filters);
    } else {
      filterStateCache.delete(this.sourcePath);
    }
  }

  /**
   * Triggered by vault 'modify' events for files other than the source note.
   * Uses a longer debounce (1 s) to allow Dataview to re-index before re-querying.
   */
  private debouncedAutoRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.activeView?.refreshOutput();
    }, DEBOUNCE_MS.TASKS);
  }
}
