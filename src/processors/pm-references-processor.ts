import { MarkdownRenderChild, TFile, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type { Plugin } from "obsidian";
import type { ReferenceProcessorServices } from "../plugin-context";
import type { PmReferencesConfig, SavedReferenceFilters, ReferenceFilters, ReferenceViewMode } from "../types";
import { ReferenceDashboardView } from "./pm-references-dashboard";
import { renderError } from "./dom-helpers";
import { DEBOUNCE_MS, CODEBLOCK, FM_KEY } from "../constants";

/**
 * Renders the pm-references dashboard — a filterable, grouped view of all reference notes.
 *
 * Usage:
 * ```pm-references
 * viewMode: topic
 * ```
 *
 * Filter state is persisted to the note's frontmatter under the `pm-references-filters` key.
 */
export function registerPmReferencesProcessor(
  plugin: Plugin,
  services: ReferenceProcessorServices
): void {
  plugin.registerMarkdownCodeBlockProcessor(
    CODEBLOCK.PM_REFERENCES,
    (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      const child = new PmReferencesRenderChild(el, source, ctx.sourcePath, services);
      ctx.addChild(child);
      child.render();
    }
  );
}

// ─── Render child ─────────────────────────────────────────────────────────────

class PmReferencesRenderChild extends MarkdownRenderChild {
  private config: PmReferencesConfig = {};
  private activeView: ReferenceDashboardView | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isUpdating = false;

  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly sourcePath: string,
    private readonly services: ReferenceProcessorServices
  ) {
    super(containerEl);
  }

  onload(): void {
    // Auto-refresh when any vault file is modified, with debounce to allow Dataview re-indexing.
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
      const parsed = this.source.trim()
        ? (parseYaml(this.source) as PmReferencesConfig)
        : {};
      this.config = parsed ?? {};
    } catch {
      const msg = "Invalid pm-references config.";
      this.services.loggerService.warn(msg, "pm-references-processor");
      renderError(this.containerEl, msg);
      return;
    }

    const savedFilters = this.loadSavedFilters();

    this.activeView = new ReferenceDashboardView(
      this.containerEl,
      this.services,
      this.config,
      savedFilters,
      (filters) => this.debouncedSaveFilters(filters)
    );
    this.activeView.render();
  }

  private loadSavedFilters(): ReferenceFilters | null {
    const file = this.services.app.vault.getAbstractFileByPath(this.sourcePath);
    if (!(file instanceof TFile)) return null;
    const saved = this.services.app.metadataCache.getFileCache(file)?.frontmatter?.[FM_KEY.PM_REFERENCES_FILTERS] as SavedReferenceFilters | undefined;
    if (!saved) return null;
    return {
      viewMode: (saved.viewMode as ReferenceViewMode) ?? "topic",
      topics: saved.topics ?? [],
      clients: saved.clients ?? [],
      engagements: saved.engagements ?? [],
      searchText: "",
      selectedNode: saved.selectedNode,
    };
  }

  private debouncedSaveFilters(filters: ReferenceFilters): void {
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      void this.persistFilters(filters);
    }, DEBOUNCE_MS.PROPERTIES);
  }

  private async persistFilters(filters: ReferenceFilters): Promise<void> {
    const file = this.services.app.vault.getAbstractFileByPath(this.sourcePath);
    if (!(file instanceof TFile)) return;
    this.isUpdating = true;
    try {
      const saved: SavedReferenceFilters = {
        viewMode: filters.viewMode,
        topics: filters.topics,
        clients: filters.clients,
        engagements: filters.engagements,
        selectedNode: filters.selectedNode,
      };
      await this.services.app.fileManager.processFrontMatter(
        file,
        (fm: Record<string, unknown>) => {
          fm[FM_KEY.PM_REFERENCES_FILTERS] = saved;
        }
      );
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Triggered by vault 'modify' events.
   * Uses a longer debounce to allow Dataview to re-index before re-querying.
   */
  private debouncedAutoRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.activeView?.refreshOutput();
    }, DEBOUNCE_MS.TASKS);
  }
}
