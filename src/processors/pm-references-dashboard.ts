import type { ReferenceProcessorServices } from "../plugin-context";
import type { PmReferencesConfig, ReferenceFilters, ReferenceViewMode } from "../types";
import { ENTITY_TAGS, DEBOUNCE_MS } from "../constants";
import { normalizeToName } from "../utils/link-utils";
import { renderTopicView } from "./reference-views/topic-view-renderer";
import { renderClientView } from "./reference-views/client-view-renderer";
import { renderEngagementView } from "./reference-views/engagement-view-renderer";
import { FilterChipSelect } from "../ui/components/filter-chip-select";
import { buildEntityOptions } from "../utils/filter-utils";

// ─── View mode tab definitions ────────────────────────────────────────────────

const VIEW_TABS: Array<{ mode: ReferenceViewMode; label: string }> = [
  { mode: "topic", label: "By Topic" },
  { mode: "client", label: "By Client" },
  { mode: "engagement", label: "By Engagement" },
];

// ─── Default filter factory ───────────────────────────────────────────────────

function defaultFilters(config: PmReferencesConfig): ReferenceFilters {
  return {
    viewMode: (config.viewMode as ReferenceViewMode) ?? "topic",
    topics: config.filter?.topics ?? [],
    clients: [],
    engagements: [],
    searchText: "",
  };
}

// ─── ReferenceDashboardView ───────────────────────────────────────────────────

/**
 * Renders the full pm-references dashboard UI.
 *
 * Responsible for:
 *   - View mode tabs (By Topic / By Client / By Engagement)
 *   - Collapsible filter panel (topic / client / engagement chips + clear button)
 *   - Search input with debounce
 *   - Dispatching to the appropriate view renderer
 */
export class ReferenceDashboardView {
  private filters: ReferenceFilters;
  private filtersExpanded = false;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private outputEl!: HTMLElement;
  private chipSelects: FilterChipSelect[] = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly services: ReferenceProcessorServices,
    private readonly config: PmReferencesConfig,
    savedFilters: ReferenceFilters | null,
    private readonly onFiltersChange: (filters: ReferenceFilters) => void
  ) {
    this.filters = savedFilters ?? defaultFilters(config);
  }

  render(): void {
    for (const cs of this.chipSelects) cs.destroy();
    this.chipSelects = [];
    this.container.empty();

    const root = this.container.createDiv({ cls: "pm-references" });

    this.renderControls(root);
    this.renderFilterPanel(root);
    this.outputEl = root.createDiv({ cls: "pm-references__output" });
    this.renderOutput();
  }

  /** Re-renders only the output section (called on vault modify auto-refresh). */
  refreshOutput(): void {
    if (this.outputEl) {
      this.outputEl.empty();
      this.renderOutput();
    }
  }

  // ─── Controls row ──────────────────────────────────────────────────────────

  private renderControls(root: HTMLElement): void {
    const toolbar = root.createDiv({ cls: "pm-references__toolbar" });

    // View mode tabs
    const tabsEl = toolbar.createDiv({ cls: "pm-references__tabs" });
    for (const tab of VIEW_TABS) {
      const btn = tabsEl.createEl("button", {
        cls: `pm-references__tab${this.filters.viewMode === tab.mode ? " pm-references__tab--active" : ""}`,
        text: tab.label,
      });
      btn.addEventListener("click", () => {
        this.filters = { ...this.filters, viewMode: tab.mode };
        this.onFiltersChange(this.filters);
        this.render();
      });
    }

    // Filters toggle button
    const filtersBtn = toolbar.createEl("button", {
      cls: "pm-references__filters-toggle",
      text: this.filtersExpanded ? "Filters ▴" : "Filters ▾",
    });
    filtersBtn.addEventListener("click", () => {
      this.filtersExpanded = !this.filtersExpanded;
      this.render();
    });

    // Search input
    const searchInput = toolbar.createEl("input", {
      cls: "pm-references__search",
      attr: {
        type: "text",
        placeholder: "Search references…",
        value: this.filters.searchText,
      },
    });
    searchInput.addEventListener("input", () => {
      if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.filters = { ...this.filters, searchText: searchInput.value };
        this.onFiltersChange(this.filters);
        this.outputEl.empty();
        this.renderOutput();
      }, DEBOUNCE_MS.SEARCH);
    });
  }

  // ─── Filter panel ──────────────────────────────────────────────────────────

  private renderFilterPanel(root: HTMLElement): void {
    const panel = root.createDiv({
      cls: `pm-references__filter-panel${this.filtersExpanded ? " pm-references__filter-panel--open" : ""}`,
    });
    if (!this.filtersExpanded) {
      panel.style.display = "none";
      return;
    }

    // Topic chips
    const topicRow = panel.createDiv({ cls: "pm-references__filter-row pm-references__filter-row--topic" });
    topicRow.createSpan({ cls: "pm-references__filter-label", text: "Topics" });
    const topicChips = topicRow.createDiv({ cls: "pm-references__chips" });
    const allTopics = this.services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.referenceTopic);
    for (const topicPage of allTopics) {
      const wikilink = `[[${topicPage.file.name}]]`;
      const active = this.filters.topics.includes(wikilink);
      const chip = topicChips.createEl("button", {
        cls: `pm-ref-filter-chip${active ? " pm-ref-filter-chip--active" : ""}`,
        text: topicPage.file.name,
      });
      chip.addEventListener("click", () => {
        const next = active
          ? this.filters.topics.filter((t) => t !== wikilink)
          : [...this.filters.topics, wikilink];
        this.filters = { ...this.filters, topics: next };
        this.onFiltersChange(this.filters);
        this.render();
      });
    }

    // Client FilterChipSelect
    const clientRow = panel.createDiv({ cls: "pm-references__filter-row pm-references__filter-row--client" });
    clientRow.createSpan({ cls: "pm-references__filter-label", text: "Clients" });
    const clientOptions = buildEntityOptions(ENTITY_TAGS.client, this.services.queryService);
    const clientChipSelect = new FilterChipSelect(clientRow, this.services.app, {
      options: clientOptions,
      selectedValues: this.filters.clients,
      placeholder: "Filter by client…",
      ariaLabel: "Filter by client",
      includeUnassigned: false,
      unassignedLabel: "Include unassigned",
      showUnassignedCheckbox: false,
      onChange: (selectedValues) => {
        this.filters = { ...this.filters, clients: selectedValues };
        this.onFiltersChange(this.filters);
        this.render();
      },
    });
    this.chipSelects.push(clientChipSelect);

    // Engagement FilterChipSelect
    const engagementRow = panel.createDiv({ cls: "pm-references__filter-row pm-references__filter-row--engagement" });
    engagementRow.createSpan({ cls: "pm-references__filter-label", text: "Engagements" });
    const engagementOptions = buildEntityOptions(ENTITY_TAGS.engagement, this.services.queryService);
    const engagementChipSelect = new FilterChipSelect(engagementRow, this.services.app, {
      options: engagementOptions,
      selectedValues: this.filters.engagements,
      placeholder: "Filter by engagement…",
      ariaLabel: "Filter by engagement",
      includeUnassigned: false,
      unassignedLabel: "Include unassigned",
      showUnassignedCheckbox: false,
      onChange: (selectedValues) => {
        this.filters = { ...this.filters, engagements: selectedValues };
        this.onFiltersChange(this.filters);
        this.render();
      },
    });
    this.chipSelects.push(engagementChipSelect);

    // Clear filters button
    const clearBtn = panel.createEl("button", {
      cls: "pm-references__clear-filters",
      text: "Clear filters",
    });
    clearBtn.addEventListener("click", () => {
      this.filters = { ...this.filters, topics: [], clients: [], engagements: [], searchText: "" };
      this.onFiltersChange(this.filters);
      this.render();
    });
  }

  // ─── Output rendering ─────────────────────────────────────────────────────

  private renderOutput(): void {
    const topicFilters = this.filters.topics
      .map((wl) => normalizeToName(wl))
      .filter((n): n is string => n !== null && n !== undefined);

    let references = this.services.queryService.getReferences({
      topics: topicFilters.length > 0 ? topicFilters : undefined,
      clients: this.filters.clients.length > 0 ? this.filters.clients : undefined,
      engagements: this.filters.engagements.length > 0 ? this.filters.engagements : undefined,
    });

    // Apply text search (not handled by query service)
    if (this.filters.searchText) {
      const search = this.filters.searchText.toLowerCase();
      references = references.filter((ref) =>
        ref.file.name.toLowerCase().includes(search)
      );
    }

    switch (this.filters.viewMode) {
      case "topic":
        renderTopicView(this.outputEl, references, this.services);
        break;
      case "client":
        renderClientView(this.outputEl, references, this.services);
        break;
      case "engagement":
        renderEngagementView(this.outputEl, references, this.services);
        break;
    }
  }
}
