import { ItemView, WorkspaceLeaf } from "obsidian";
import type ProjectManagerPlugin from "../main";
import type { ReferenceProcessorServices } from "../plugin-context";
import { ReferenceDashboardView } from "../processors/pm-references-dashboard";
import { PM_REFERENCE_DASHBOARD_VIEW_TYPE, DEBOUNCE_MS } from "../constants";
import type { ReferenceFilters, SavedReferenceFilters } from "../types";

/**
 * ItemView panel for the Reference Dashboard.
 *
 * Hosts the full ReferenceDashboardView component in an Obsidian sidebar leaf,
 * eliminating the .markdown-rendered CSS context interference of the pm-references
 * code block processor. Filter state is persisted to plugin settings rather than
 * note frontmatter.
 */
export class ReferenceDashboardItemView extends ItemView {
  static readonly VIEW_TYPE = PM_REFERENCE_DASHBOARD_VIEW_TYPE;

  private dashboardView: ReferenceDashboardView | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ProjectManagerPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return ReferenceDashboardItemView.VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Reference Dashboard";
  }

  getIcon(): string {
    return "book-open";
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async onOpen(): Promise<void> {
    this.contentEl.addClass("pm-reference-dashboard-view");

    const services: ReferenceProcessorServices = {
      app: this.plugin.app,
      settings: this.plugin.settings,
      queryService: this.plugin.queryService,
      hierarchyService: this.plugin.hierarchyService,
      loggerService: this.plugin.loggerService,
      commandExecutor: this.plugin.commandExecutor,
      actionContext: this.plugin.actionContext,
      saveSettings: this.plugin.saveSettings.bind(this.plugin),
    };

    const actionsRow = this.contentEl.createDiv({ cls: 'pm-reference-dashboard__actions' });

    const newRefBtn = actionsRow.createEl('button', {
      cls: 'pm-reference-dashboard__actions__button',
      text: '+ New Reference',
    });
    newRefBtn.addEventListener('click', () => {
      const selectedNode = this.plugin.settings.ui.referenceDashboardFilters?.selectedNode;
      if (selectedNode) {
        services.actionContext.set({ field: 'topic', value: selectedNode });
      }
      services.commandExecutor.executeCommandById('project-manager:create-reference');
    });

    const newTopicBtn = actionsRow.createEl('button', {
      cls: 'pm-reference-dashboard__actions__button',
      text: '+ New Topic',
    });
    newTopicBtn.addEventListener('click', () => {
      services.commandExecutor.executeCommandById('project-manager:create-reference-topic');
    });

    const saved = this.plugin.settings.ui.referenceDashboardFilters;
    const savedFilters: ReferenceFilters | null = saved
      ? {
          viewMode: saved.viewMode ?? "topic",
          topics: saved.topics ?? [],
          clients: saved.clients ?? [],
          engagements: saved.engagements ?? [],
          searchText: "",
          selectedNode: saved.selectedNode,
        }
      : null;

    const dashboardContainer = this.contentEl.createDiv();

    this.dashboardView = new ReferenceDashboardView(
      dashboardContainer,
      services,
      {},
      savedFilters,
      (filters) => this.onFiltersChange(filters)
    );
    this.dashboardView.render();

    this.registerEvent(
      this.plugin.app.vault.on("modify", () => {
        this.debouncedRefresh();
      })
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async onClose(): Promise<void> {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.dashboardView = null;
    this.contentEl.empty();
  }

  private onFiltersChange(filters: ReferenceFilters): void {
    const saved: SavedReferenceFilters = {
      viewMode: filters.viewMode,
      topics: filters.topics,
      clients: filters.clients,
      engagements: filters.engagements,
      selectedNode: filters.selectedNode,
    };
    this.plugin.settings.ui.referenceDashboardFilters = saved;
    void this.plugin.saveSettings();
  }

  private debouncedRefresh(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.dashboardView?.refreshOutput();
    }, DEBOUNCE_MS.TASKS);
  }
}
