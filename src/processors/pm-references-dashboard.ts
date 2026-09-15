import type { ReferenceProcessorServices } from "../plugin-context";
import type {
  DataviewPage,
  PmReferencesConfig,
  ReferenceFilters,
  ReferenceViewMode,
  SavedReferenceFilters,
} from "../types";
import {
  ENTITY_TAGS,
  DEBOUNCE_MS,
  CSS_CLS,
  HTML_TAG,
  DOM_EVENT,
  INPUT_TYPE,
  MSG,
  LOG_CONTEXT,
  ACTION_CTX_FIELD,
  REFERENCE_VIEW_MODE,
  REFERENCES_DASHBOARD_MSG,
  REFERENCES_DASHBOARD_TEXT,
} from "../constants";
import { COMMAND_IDS } from "../command-ids";
import { debounced } from "../utils/debounce";
import { RefQuery } from "../services/ref-query";
import { buildReferenceFilterSpec, buildReferenceFilterState } from "../services/reference-filter";
import { buildReferenceViews } from "./reference-views";
import type { ReferenceViewSet, RefRenderHelpers } from "./reference-views";
import { DashboardShell } from "./dashboard-shell";
import type { DashboardShellDeps } from "./dashboard-shell";
import type { DashboardViewComponent } from "./dashboard-render-child";
import { renderError } from "./dom-helpers";
import { FilterChipSelect } from "../ui/components/filter-chip-select";
import { buildEntityOptions } from "../utils/filter-utils";

// ─── View mode tab definitions ────────────────────────────────────────────────

const VIEW_TABS: Array<{ mode: ReferenceViewMode; label: string }> = [
  { mode: REFERENCE_VIEW_MODE.TOPIC, label: REFERENCES_DASHBOARD_TEXT.TAB_TOPIC },
  { mode: REFERENCE_VIEW_MODE.CLIENT, label: REFERENCES_DASHBOARD_TEXT.TAB_CLIENT },
  { mode: REFERENCE_VIEW_MODE.ENGAGEMENT, label: REFERENCES_DASHBOARD_TEXT.TAB_ENGAGEMENT },
];

/** Builds the initial filter model from saved state, falling back to the code-block config. */
function initFilters(saved: SavedReferenceFilters | null, config: PmReferencesConfig): ReferenceFilters {
  return {
    viewMode: saved?.viewMode ?? (config.viewMode as ReferenceViewMode) ?? REFERENCE_VIEW_MODE.TOPIC,
    topics: saved?.topics ?? config.filter?.topics ?? [],
    clients: saved?.clients ?? [],
    engagements: saved?.engagements ?? [],
    searchText: "",
    selectedNode: saved?.selectedNode,
  };
}

// ─── ReferenceDashboardView ───────────────────────────────────────────────────

/**
 * The References dashboard's view component: owns the actions row, the view-mode
 * tabs, the collapsible filter panel, and the filter state, and drives the shared
 * {@link DashboardShell} to repaint the two-panel body (sidebar + content). The
 * shell owns only the resolve → filter → render data-flow and dispatches to the
 * topic / client / engagement renderer via `views[viewMode]`; persistence is
 * delegated to a {@link SettingsViewStore} through `onSaveFilters`. `searchText`
 * stays ephemeral — enforced by the {@link SavedReferenceFilters} type persisted.
 */
export class ReferenceDashboardView implements DashboardViewComponent {
  private filters: ReferenceFilters;
  private filtersExpanded = false;
  private outputEl!: HTMLElement;
  private searchInputEl: HTMLInputElement | null = null;
  private chipSelects: FilterChipSelect[] = [];
  private readonly search = debounced(() => this.applySearch(), DEBOUNCE_MS.SEARCH);
  private readonly refQuery: RefQuery;
  private readonly views: ReferenceViewSet;

  constructor(
    private readonly container: HTMLElement,
    private readonly services: ReferenceProcessorServices,
    private readonly config: PmReferencesConfig,
    savedFilters: SavedReferenceFilters | null,
    private readonly onSaveFilters: (filters: SavedReferenceFilters | null) => void
  ) {
    this.refQuery = new RefQuery(() => services.queryService.dv());
    this.views = buildReferenceViews({ hierarchyService: services.hierarchyService });
    this.filters = initFilters(savedFilters, config);
  }

  render(): void {
    this.destroyChipSelects();
    this.container.empty();

    this.renderActionsRow(this.container);
    const root = this.container.createDiv({ cls: CSS_CLS.REFERENCES });
    this.renderControls(root);
    this.renderFilterPanel(root);
    this.outputEl = root.createDiv({ cls: CSS_CLS.REFERENCES_BODY });
    this.refreshOutput();
  }

  /** Re-runs the shell data-flow and repaints the body (filter UI is preserved). */
  refreshOutput(): void {
    if (this.outputEl) void this.renderShell();
  }

  destroy(): void {
    this.search.cancel();
    this.destroyChipSelects();
  }

  // ─── Persistence ─────────────────────────────────────────────────────────────

  /** Persists the durable filter subset (drops ephemeral `searchText`). */
  private persistFilters(): void {
    const f = this.filters;
    const toSave: SavedReferenceFilters = {
      viewMode: f.viewMode,
      topics: f.topics,
      clients: f.clients,
      engagements: f.engagements,
      selectedNode: f.selectedNode,
    };
    this.onSaveFilters(toSave);
  }

  // ─── Actions row ─────────────────────────────────────────────────────────────

  private renderActionsRow(container: HTMLElement): void {
    const actionsRow = container.createDiv({ cls: CSS_CLS.REFERENCE_DASHBOARD_ACTIONS });

    const newRefBtn = actionsRow.createEl(HTML_TAG.BUTTON, {
      cls: CSS_CLS.REFERENCE_DASHBOARD_ACTIONS_BUTTON,
      text: REFERENCES_DASHBOARD_TEXT.NEW_REFERENCE,
    });
    newRefBtn.addEventListener(DOM_EVENT.CLICK, () => {
      const selectedNode = this.filters.selectedNode;
      if (selectedNode) {
        this.services.actionContext.set({ field: ACTION_CTX_FIELD.TOPIC, value: selectedNode });
      }
      this.services.commandExecutor.executeCommandById(COMMAND_IDS.CREATE_REFERENCE);
    });

    const newTopicBtn = actionsRow.createEl(HTML_TAG.BUTTON, {
      cls: CSS_CLS.REFERENCE_DASHBOARD_ACTIONS_BUTTON,
      text: REFERENCES_DASHBOARD_TEXT.NEW_TOPIC,
    });
    newTopicBtn.addEventListener(DOM_EVENT.CLICK, () => {
      this.services.commandExecutor.executeCommandById(COMMAND_IDS.CREATE_REFERENCE_TOPIC);
    });
  }

  // ─── Controls row (tabs + filters toggle + search) ─────────────────────────

  private renderControls(root: HTMLElement): void {
    const toolbar = root.createDiv({ cls: CSS_CLS.REFERENCES_TOOLBAR });

    const tabsEl = toolbar.createDiv({ cls: CSS_CLS.REFERENCES_TABS });
    for (const tab of VIEW_TABS) {
      const btn = tabsEl.createEl(HTML_TAG.BUTTON, {
        cls:
          this.filters.viewMode === tab.mode
            ? `${CSS_CLS.REFERENCES_TAB} ${CSS_CLS.REFERENCES_TAB_ACTIVE}`
            : CSS_CLS.REFERENCES_TAB,
        text: tab.label,
      });
      btn.addEventListener(DOM_EVENT.CLICK, () => {
        // Reset selectedNode when switching view modes.
        this.filters = { ...this.filters, viewMode: tab.mode, selectedNode: undefined };
        this.persistFilters();
        this.render();
      });
    }

    const filtersBtn = toolbar.createEl(HTML_TAG.BUTTON, {
      cls: CSS_CLS.REFERENCES_FILTERS_TOGGLE,
      text: this.filtersExpanded
        ? REFERENCES_DASHBOARD_TEXT.FILTERS_EXPANDED
        : REFERENCES_DASHBOARD_TEXT.FILTERS_COLLAPSED,
    });
    filtersBtn.addEventListener(DOM_EVENT.CLICK, () => {
      this.filtersExpanded = !this.filtersExpanded;
      this.render();
    });

    const searchInput = toolbar.createEl(HTML_TAG.INPUT, {
      cls: CSS_CLS.REFERENCES_SEARCH,
      attr: {
        type: INPUT_TYPE.TEXT,
        placeholder: REFERENCES_DASHBOARD_TEXT.SEARCH_PLACEHOLDER,
        value: this.filters.searchText,
      },
    });
    searchInput.addEventListener(DOM_EVENT.INPUT, () => {
      this.searchInputEl = searchInput;
      this.search.trigger();
    });
  }

  private applySearch(): void {
    const input = this.searchInputEl;
    if (!input) return;
    this.filters = { ...this.filters, searchText: input.value };
    this.refreshOutput();
  }

  // ─── Filter panel ──────────────────────────────────────────────────────────

  private renderFilterPanel(root: HTMLElement): void {
    const panel = root.createDiv({
      cls: this.filtersExpanded
        ? `${CSS_CLS.REFERENCES_FILTER_PANEL} ${CSS_CLS.REFERENCES_FILTER_PANEL_OPEN}`
        : CSS_CLS.REFERENCES_FILTER_PANEL,
    });
    if (!this.filtersExpanded) {
      panel.style.display = "none";
      return;
    }

    this.renderChipFilterRow(
      panel,
      CSS_CLS.REFERENCES_FILTER_ROW_TOPIC,
      REFERENCES_DASHBOARD_TEXT.TOPICS_LABEL,
      ENTITY_TAGS.referenceTopic,
      this.filters.topics,
      REFERENCES_DASHBOARD_TEXT.TOPIC_FILTER_PLACEHOLDER,
      REFERENCES_DASHBOARD_TEXT.TOPIC_FILTER_ARIA,
      (values) => { this.filters = { ...this.filters, topics: values }; }
    );
    this.renderChipFilterRow(
      panel,
      CSS_CLS.REFERENCES_FILTER_ROW_CLIENT,
      REFERENCES_DASHBOARD_TEXT.CLIENTS_LABEL,
      ENTITY_TAGS.client,
      this.filters.clients,
      REFERENCES_DASHBOARD_TEXT.CLIENT_FILTER_PLACEHOLDER,
      REFERENCES_DASHBOARD_TEXT.CLIENT_FILTER_ARIA,
      (values) => { this.filters = { ...this.filters, clients: values }; }
    );
    this.renderChipFilterRow(
      panel,
      CSS_CLS.REFERENCES_FILTER_ROW_ENGAGEMENT,
      REFERENCES_DASHBOARD_TEXT.ENGAGEMENTS_LABEL,
      ENTITY_TAGS.engagement,
      this.filters.engagements,
      REFERENCES_DASHBOARD_TEXT.ENGAGEMENT_FILTER_PLACEHOLDER,
      REFERENCES_DASHBOARD_TEXT.ENGAGEMENT_FILTER_ARIA,
      (values) => { this.filters = { ...this.filters, engagements: values }; }
    );

    const clearBtn = panel.createEl(HTML_TAG.BUTTON, {
      cls: CSS_CLS.REFERENCES_CLEAR_FILTERS,
      text: REFERENCES_DASHBOARD_TEXT.CLEAR_FILTERS,
    });
    clearBtn.addEventListener(DOM_EVENT.CLICK, () => {
      this.filters = { ...this.filters, topics: [], clients: [], engagements: [], searchText: "" };
      this.persistFilters();
      this.render();
    });
  }

  private renderChipFilterRow(
    panel: HTMLElement,
    rowModifierClass: string,
    label: string,
    tag: string,
    selectedValues: string[],
    placeholder: string,
    ariaLabel: string,
    applyValues: (values: string[]) => void
  ): void {
    const row = panel.createDiv({ cls: `${CSS_CLS.REFERENCES_FILTER_ROW} ${rowModifierClass}` });
    row.createSpan({ cls: CSS_CLS.REFERENCES_FILTER_LABEL, text: label });
    const chipSelect = new FilterChipSelect(row, this.services.app, {
      options: buildEntityOptions(tag, this.services.queryService),
      selectedValues,
      placeholder,
      ariaLabel,
      showUnassignedCheckbox: false,
      onChange: (values) => {
        applyValues(values);
        this.persistFilters();
        this.render();
      },
    });
    this.chipSelects.push(chipSelect);
  }

  private destroyChipSelects(): void {
    for (const chipSelect of this.chipSelects) chipSelect.destroy();
    this.chipSelects = [];
  }

  // ─── Shell wiring ────────────────────────────────────────────────────────────

  private async renderShell(): Promise<void> {
    const dv = this.services.queryService.dv();
    if (!dv) {
      this.outputEl.empty();
      this.outputEl.createEl(HTML_TAG.EM, { text: MSG.DATAVIEW_UNAVAILABLE });
      return;
    }
    try {
      await this.buildShell().render(this.outputEl);
    } catch (err) {
      this.services.loggerService.error(String(err), LOG_CONTEXT.REFERENCE_DASHBOARD_VIEW, err);
      this.outputEl.empty();
      renderError(this.outputEl, REFERENCES_DASHBOARD_MSG.ERROR(String(err)));
    }
  }

  /**
   * Assembles the generic {@link DashboardShell} from the reference query, the
   * view-mode-keyed renderers, and the reference spec/state builders. The shell
   * owns only the data-flow; the filter panel and persistence stay on this view.
   * `buildHelpers` supplies the UNFILTERED reference set and topic tree (the shell
   * hands renderers only the filtered items), so the flat sidebars and the topic
   * tree render from a stable, filter-independent node-set. A sidebar node click
   * arrives here through `onFilterChange`, persists, and repaints the body.
   */
  private buildShell(): DashboardShell<DataviewPage, RefRenderHelpers, ReferenceFilters> {
    const cardServices = {
      app: this.services.app,
      navigationService: this.services.navigationService,
      loggerService: this.services.loggerService,
    };
    const deps: DashboardShellDeps<DataviewPage, RefRenderHelpers, ReferenceFilters> = {
      query: this.refQuery,
      views: this.views,
      getViewMode: () => this.filters.viewMode,
      getFilters: () => this.filters,
      buildSpec: () => buildReferenceFilterSpec({ hierarchyService: this.services.hierarchyService }),
      buildState: () => buildReferenceFilterState(this.filters),
      buildHelpers: (_filtered, allReferences) => ({
        topicTree: this.refQuery.getReferenceTopicTree(),
        allReferences,
        cardServices,
      }),
      onFilterChange: (patch) => {
        Object.assign(this.filters, patch);
        this.persistFilters();
        this.refreshOutput();
      },
      // Unused while renderWhenEmpty is set (the renderers own their empty-state),
      // but the shell contract requires a message; reuse the renderers' copy.
      emptyMessage: REFERENCES_DASHBOARD_TEXT.NO_REFERENCES,
      onUnknownMode: (el, mode) => renderError(el, REFERENCES_DASHBOARD_MSG.UNKNOWN_VIEW_MODE(mode)),
      // Keep the sidebar (built from the unfiltered node-set) visible even when
      // the active filters exclude every reference — the renderers own the
      // empty-state in the content panel. Preserves the pre-migration behaviour.
      renderWhenEmpty: true,
    };
    return new DashboardShell(deps);
  }
}
