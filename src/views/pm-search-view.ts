import { TFile, prepareFuzzySearch, setIcon } from "obsidian";
import type { SearchViewServices } from "../plugin-context";
import type { DashboardViewComponent } from "../processors/dashboard-render-child";
import { ENTITY_PRESENTATION, ENTITY_FAMILY_GROUPS } from "../entity-registry";
import type { EntityPresentation, EntityFamilyGroup } from "../entity-registry";
import { cssVar } from "../processors/dom-helpers";
import { debounced } from "../utils/debounce";
import type { Debounced } from "../utils/debounce";
import { FilterChipSelect } from "../ui/components/filter-chip-select";
import type {
  AutocompleteOption,
  DataviewPage,
  EntityType,
  SavedSearchFilters,
  SearchResult,
} from "../types";
import {
  ALL_ENTITY_TYPES,
  ARIA_BOOL,
  CSS_CLS,
  CSS_DISPLAY,
  DEBOUNCE_MS,
  DOM_ATTR,
  DOM_EVENT,
  ENTITY_FAMILY_COLOR_TOKEN,
  ENTITY_FAMILY_LABEL,
  ENTITY_TYPE,
  HTML_TAG,
  INFERRED_KEY_SEP,
  INPUT_TYPE,
  LOG_CONTEXT,
  PM_SEARCH_DOT_VAR,
  PM_SEARCH_FAMILY_VAR,
  PM_SEARCH_GLYPH,
  PM_SEARCH_TEXT,
  SEARCH_FACET_ENTITY_TYPE,
  SEARCH_FACET_KEY,
  SEARCH_FACET_ORDER,
  SEARCH_FACET_TEXT,
} from "../constants";
import {
  activeTypesOf,
  clearFilterState,
  facetValues,
  hasActiveFilter,
  initSearchFilterState,
  scopeOf,
  serializeSearchFilters,
  setFacetValues,
} from "./search-filter-state";
import type { SearchFacetKey, SearchFilterState } from "./search-filter-state";

/** A query compiled once per repaint, then applied to each row's name for match highlighting. */
type FuzzyHighlighter = ReturnType<typeof prepareFuzzySearch>;

/** Types whose breadcrumb reads "Knowledge base" when no client/engagement resolves. */
const KNOWLEDGE_BASE_TYPES = new Set<EntityType>([ENTITY_TYPE.REFERENCE, ENTITY_TYPE.REFERENCE_TOPIC]);

/** Composite key marking one facet value as inferred (auto-seeded from the active note). */
function inferredKey(key: SearchFacetKey, value: string): string {
  return `${key}${INFERRED_KEY_SEP}${value}`;
}

/**
 * The search panel's view component: a fuzzy search box, a filter zone (a drawer
 * toggle, a "Narrow by…" scope add button with a Clear button, an active-scope
 * chips bar, and a collapsible drawer of client/engagement/person scope facets
 * plus family-grouped entity-type toggles), a right-aligned count row, and a
 * ranked results list, all wired to {@link SearchViewServices}.
 *
 * {@link SearchFilterState} is the single source of truth: scope facets, active
 * chips, the search call, and persistence all read and write it. Each scope facet
 * reuses {@link FilterChipSelect}; its candidate names and chip-dot colour come
 * from {@link SEARCH_FACET_ENTITY_TYPE} via the presentation registry (no per-view
 * style map). On open the active note's client/engagement are resolved and
 * pre-added as inferred chips (a home-glyph prefix). OR combines within a facet,
 * AND across facets and the type filter — the search service applies the scope.
 * The whole state persists to settings on every change and restores on reopen.
 */
export class PmSearchView implements DashboardViewComponent {
  private query = "";
  private readonly state: SearchFilterState;
  private inputEl!: HTMLInputElement;
  private clearBtn!: HTMLButtonElement;
  private addBtnEl!: HTMLButtonElement;
  private clearFiltersBtnEl!: HTMLButtonElement;
  private drawerEl!: HTMLElement;
  private chipsBarEl!: HTMLElement;
  private countEl!: HTMLElement;
  private resultsEl!: HTMLElement;
  private drawerOpen = false;
  private seeded = false;
  private readonly typeToggleEls = new Map<EntityType, HTMLButtonElement>();
  private readonly facetEls = new Map<SearchFacetKey, HTMLElement>();
  private readonly facetChipSelects = new Map<SearchFacetKey, FilterChipSelect>();
  private readonly inferred = new Set<string>();
  private readonly search: Debounced = debounced(() => this.repaint(), DEBOUNCE_MS.SEARCH);

  constructor(
    private readonly container: HTMLElement,
    private readonly services: SearchViewServices,
    savedFilters: SavedSearchFilters | null = null,
    private readonly onSaveFilters: (filters: SavedSearchFilters | null) => void = () => {}
  ) {
    this.state = initSearchFilterState(savedFilters);
  }

  render(): void {
    this.container.empty();
    this.typeToggleEls.clear();
    this.destroyChipSelects();
    this.facetEls.clear();
    this.autoSeed();
    const root = this.container.createDiv({ cls: CSS_CLS.PM_SEARCH });
    const commandZone = root.createDiv({ cls: CSS_CLS.PM_SEARCH_COMMAND_ZONE });
    this.buildSearchBox(commandZone);
    this.buildFilterZone(commandZone);
    this.countEl = commandZone.createDiv({ cls: CSS_CLS.PM_SEARCH_COUNT });
    this.resultsEl = root.createDiv({ cls: CSS_CLS.PM_SEARCH_RESULTS });
    this.repaint();
  }

  /** Re-runs the search and repaints the count and results (search box preserved). */
  refreshOutput(): void {
    if (this.resultsEl) this.repaint();
  }

  destroy(): void {
    this.search.cancel();
    this.destroyChipSelects();
    this.typeToggleEls.clear();
    this.facetEls.clear();
    this.container.empty();
  }

  // ─── Auto-seed from the active note ──────────────────────────────────────────

  /**
   * Once per open, resolves the active note's client and engagement and pre-adds
   * each (when it resolves and is not already selected) as an inferred scope chip.
   */
  private autoSeed(): void {
    if (this.seeded) return;
    this.seeded = true;
    const page = this.activeNotePage();
    if (!page) return;
    this.seedFacet(SEARCH_FACET_KEY.CLIENT, this.services.hierarchyService.resolveClientName(page));
    this.seedFacet(
      SEARCH_FACET_KEY.ENGAGEMENT,
      this.services.hierarchyService.resolveEngagementName(page)
    );
  }

  /** The active note's Dataview page, or null when there is none or Dataview is absent. */
  private activeNotePage(): DataviewPage | null {
    const dv = this.services.getDv();
    const file = this.services.app.workspace?.getActiveFile?.() ?? null;
    if (!dv || !file) return null;
    return dv.page(file.path) ?? null;
  }

  private seedFacet(key: SearchFacetKey, value: string | null): void {
    if (!value) return;
    const values = facetValues(this.state, key);
    if (values.includes(value)) return;
    setFacetValues(this.state, key, [...values, value]);
    this.inferred.add(inferredKey(key, value));
  }

  // ─── Search box ────────────────────────────────────────────────────────────

  private buildSearchBox(commandZone: HTMLElement): void {
    const box = commandZone.createDiv({ cls: CSS_CLS.PM_SEARCH_INPUT });

    const glyph = box.createSpan({ cls: CSS_CLS.PM_SEARCH_INPUT_ICON });
    setIcon(glyph, PM_SEARCH_GLYPH.SEARCH);

    this.inputEl = box.createEl(HTML_TAG.INPUT, {
      cls: CSS_CLS.PM_SEARCH_INPUT_FIELD,
      attr: {
        type: INPUT_TYPE.TEXT,
        placeholder: PM_SEARCH_TEXT.PLACEHOLDER,
        value: this.query,
      },
    });
    this.inputEl.addEventListener(DOM_EVENT.INPUT, () => this.onInput());

    this.clearBtn = box.createEl(HTML_TAG.BUTTON, {
      cls: CSS_CLS.PM_SEARCH_CLEAR,
      attr: { [DOM_ATTR.ARIA_LABEL]: PM_SEARCH_TEXT.CLEAR_ARIA },
    });
    setIcon(this.clearBtn, PM_SEARCH_GLYPH.CLEAR);
    this.clearBtn.addEventListener(DOM_EVENT.CLICK, () => this.onClear());

    this.updateClearVisibility();
  }

  private onInput(): void {
    this.query = this.inputEl.value;
    this.updateClearVisibility();
    this.search.trigger();
  }

  private onClear(): void {
    this.query = "";
    this.inputEl.value = "";
    this.updateClearVisibility();
    this.search.cancel();
    this.repaint();
  }

  /** The clear button is shown only when the field holds a query. */
  private updateClearVisibility(): void {
    this.clearBtn.style.display = this.query.length > 0 ? CSS_DISPLAY.DEFAULT : CSS_DISPLAY.NONE;
  }

  // ─── Filter zone (button + scope controls + chips bar + drawer) ──────────────

  private buildFilterZone(commandZone: HTMLElement): void {
    const zone = commandZone.createDiv({ cls: CSS_CLS.PM_SEARCH_FILTER_ZONE });
    this.buildScopeControls(zone);
    this.buildActiveChipsBar(zone);
    this.buildDrawer(zone);
  }

  /** The "Narrow by…" scope add button (the drawer toggle) plus the Clear button. */
  private buildScopeControls(zone: HTMLElement): void {
    const controls = zone.createDiv({ cls: CSS_CLS.PM_SEARCH_CONTROLS });
    this.buildAddButton(controls);
    this.buildClearFiltersButton(controls);
  }

  private buildAddButton(controls: HTMLElement): void {
    this.addBtnEl = controls.createEl(HTML_TAG.BUTTON, {
      cls: CSS_CLS.PM_SEARCH_ADD,
      attr: {
        [DOM_ATTR.ARIA_LABEL]: PM_SEARCH_TEXT.ADD_ARIA,
        [DOM_ATTR.ARIA_EXPANDED]: this.drawerAriaValue(),
      },
    });
    const plus = this.addBtnEl.createSpan({ cls: CSS_CLS.PM_SEARCH_ADD_ICON });
    setIcon(plus, PM_SEARCH_GLYPH.ADD);
    this.addBtnEl.createSpan({ cls: CSS_CLS.PM_SEARCH_ADD_LABEL, text: PM_SEARCH_TEXT.ADD_BTN });
    const chevron = this.addBtnEl.createSpan({ cls: CSS_CLS.PM_SEARCH_ADD_CHEVRON });
    setIcon(chevron, PM_SEARCH_GLYPH.CHEVRON);
    this.addBtnEl.addEventListener(DOM_EVENT.CLICK, () => this.setDrawerOpen(!this.drawerOpen));
  }

  private buildClearFiltersButton(controls: HTMLElement): void {
    this.clearFiltersBtnEl = controls.createEl(HTML_TAG.BUTTON, {
      cls: CSS_CLS.PM_SEARCH_CLEAR_FILTERS,
      text: PM_SEARCH_TEXT.CLEAR_FILTERS,
      attr: { [DOM_ATTR.ARIA_LABEL]: PM_SEARCH_TEXT.CLEAR_FILTERS_ARIA },
    });
    this.clearFiltersBtnEl.addEventListener(DOM_EVENT.CLICK, () => this.onClearFilters());
    this.updateClearFiltersVisibility();
  }

  /** `aria-expanded` string reflecting the drawer's open state. */
  private drawerAriaValue(): string {
    return this.drawerOpen ? ARIA_BOOL.TRUE : ARIA_BOOL.FALSE;
  }

  /** Reflects the open state on the add button (`aria-expanded`) and the drawer (open modifier). */
  private setDrawerOpen(open: boolean): void {
    this.drawerOpen = open;
    this.addBtnEl.setAttribute(DOM_ATTR.ARIA_EXPANDED, this.drawerAriaValue());
    this.drawerEl.classList.toggle(CSS_CLS.PM_SEARCH_DRAWER_OPEN, open);
  }

  /** The collapsible drawer: the client/engagement/person scope facets then the type toggles. */
  private buildDrawer(zone: HTMLElement): void {
    this.drawerEl = zone.createDiv({ cls: CSS_CLS.PM_SEARCH_DRAWER });
    this.drawerEl.classList.toggle(CSS_CLS.PM_SEARCH_DRAWER_OPEN, this.drawerOpen);
    this.buildScopeFacets(this.drawerEl);
    this.buildTypeToggleGroups(this.drawerEl);
  }

  // ─── Scope facets (client / engagement / person) ─────────────────────────────

  private buildScopeFacets(drawer: HTMLElement): void {
    for (const key of SEARCH_FACET_ORDER) {
      const facet = drawer.createDiv({ cls: CSS_CLS.PM_SEARCH_FACET, attr: { [DOM_ATTR.DATA_FACET]: key } });
      this.facetEls.set(key, facet);
      this.buildScopeFacet(key);
    }
  }

  /** (Re)builds one facet's label and reusable {@link FilterChipSelect} from current state. */
  private buildScopeFacet(key: SearchFacetKey): void {
    const facet = this.facetEls.get(key);
    if (!facet) return;
    facet.empty();
    const text = SEARCH_FACET_TEXT[key];
    facet.createDiv({ cls: CSS_CLS.PM_SEARCH_FACET_LABEL, text: text.label });
    const chipSelect = new FilterChipSelect(facet, this.services.app, {
      options: this.facetOptions(key),
      selectedValues: [...facetValues(this.state, key)],
      placeholder: text.placeholder,
      ariaLabel: text.aria,
      showUnassignedCheckbox: false,
      onChange: (values) => this.onScopeChange(key, values),
    });
    this.facetChipSelects.get(key)?.destroy();
    this.facetChipSelects.set(key, chipSelect);
  }

  /** The facet's candidate names, sourced from the shared entity substrate (no new query). */
  private facetOptions(key: SearchFacetKey): AutocompleteOption[] {
    const type = SEARCH_FACET_ENTITY_TYPE[key];
    return this.services.enumerator
      .candidates(type)
      .map((candidate) => ({ value: candidate.page.file.name, displayText: candidate.page.file.name }));
  }

  private onScopeChange(key: SearchFacetKey, values: string[]): void {
    for (const removed of facetValues(this.state, key)) {
      if (!values.includes(removed)) this.inferred.delete(inferredKey(key, removed));
    }
    setFacetValues(this.state, key, values);
    this.afterFilterChange();
  }

  private onRemoveScopeChip(key: SearchFacetKey, value: string): void {
    setFacetValues(
      this.state,
      key,
      facetValues(this.state, key).filter((v) => v !== value)
    );
    this.inferred.delete(inferredKey(key, value));
    this.buildScopeFacet(key); // resync the drawer editor with the removed value
    this.afterFilterChange();
  }

  private onClearFilters(): void {
    clearFilterState(this.state);
    this.inferred.clear();
    for (const [type, toggle] of this.typeToggleEls) {
      toggle.setAttribute(DOM_ATTR.ARIA_PRESSED, this.pressedValue(type));
    }
    for (const key of SEARCH_FACET_ORDER) this.buildScopeFacet(key);
    this.afterFilterChange();
  }

  // ─── Type toggles (family-grouped) ───────────────────────────────────────────

  private buildTypeToggleGroups(drawer: HTMLElement): void {
    const types = drawer.createDiv({ cls: CSS_CLS.PM_SEARCH_TYPES });
    for (const group of ENTITY_FAMILY_GROUPS) this.buildTypeToggleGroup(types, group);
  }

  private buildTypeToggleGroup(container: HTMLElement, group: EntityFamilyGroup): void {
    const groupEl = container.createDiv({ cls: CSS_CLS.PM_SEARCH_TYPE_GROUP });
    groupEl.createDiv({
      cls: CSS_CLS.PM_SEARCH_TYPE_GROUP_HEADING,
      text: ENTITY_FAMILY_LABEL[group.family],
    });
    const row = groupEl.createDiv({ cls: CSS_CLS.PM_SEARCH_TYPE_ROW });
    for (const type of group.types) this.buildTypeToggle(row, type);
  }

  /** A pressable type toggle: a family-colour dot, the type label, and `aria-pressed` state. */
  private buildTypeToggle(row: HTMLElement, type: EntityType): void {
    const presentation = ENTITY_PRESENTATION[type];
    const toggle = row.createEl(HTML_TAG.BUTTON, {
      cls: CSS_CLS.PM_SEARCH_TTOG,
      attr: {
        [DOM_ATTR.DATA_ENTITY_TYPE]: type,
        [DOM_ATTR.ARIA_PRESSED]: this.pressedValue(type),
      },
    });
    this.buildFamilyDot(toggle, CSS_CLS.PM_SEARCH_TTOG_DOT, presentation);
    toggle.createSpan({ cls: CSS_CLS.PM_SEARCH_TTOG_LABEL, text: presentation.label });
    toggle.addEventListener(DOM_EVENT.CLICK, () => this.onToggleType(type));
    this.typeToggleEls.set(type, toggle);
  }

  private onToggleType(type: EntityType): void {
    if (this.state.typeFilter.has(type)) this.state.typeFilter.delete(type);
    else this.state.typeFilter.add(type);
    this.syncTypeControls();
  }

  private onRemoveType(type: EntityType): void {
    this.state.typeFilter.delete(type);
    this.syncTypeControls();
  }

  /** Mirrors the type filter across every toggle, then applies the filter change. */
  private syncTypeControls(): void {
    for (const [type, toggle] of this.typeToggleEls) {
      toggle.setAttribute(DOM_ATTR.ARIA_PRESSED, this.pressedValue(type));
    }
    this.afterFilterChange();
  }

  /** `aria-pressed` string for a type, driven by the shared filter set. */
  private pressedValue(type: EntityType): string {
    return this.state.typeFilter.has(type) ? ARIA_BOOL.TRUE : ARIA_BOOL.FALSE;
  }

  // ─── Filter-change fan-out ───────────────────────────────────────────────────

  /** Repaints the chips bar, updates the Clear control, persists, and re-runs the search. */
  private afterFilterChange(): void {
    this.renderActiveChips();
    this.updateClearFiltersVisibility();
    this.persist();
    this.repaint();
  }

  private persist(): void {
    this.onSaveFilters(serializeSearchFilters(this.state));
  }

  private updateClearFiltersVisibility(): void {
    this.clearFiltersBtnEl.style.display = hasActiveFilter(this.state)
      ? CSS_DISPLAY.DEFAULT
      : CSS_DISPLAY.NONE;
  }

  // ─── Active-scope chips bar ──────────────────────────────────────────────────

  private buildActiveChipsBar(zone: HTMLElement): void {
    this.chipsBarEl = zone.createDiv({ cls: CSS_CLS.PM_SEARCH_CHIPS });
    this.renderActiveChips();
  }

  private renderActiveChips(): void {
    this.chipsBarEl.empty();
    let scopeChipCount = 0;
    for (const key of SEARCH_FACET_ORDER) {
      for (const value of facetValues(this.state, key)) {
        this.buildScopeChip(this.chipsBarEl, key, value);
        scopeChipCount++;
      }
    }
    const types = this.activeChipTypes();
    for (const type of types) this.buildTypeChip(this.chipsBarEl, type);
    if (scopeChipCount === 0 && types.length === 0) {
      this.chipsBarEl.createDiv({ cls: CSS_CLS.PM_SEARCH_CHIPS_EMPTY, text: PM_SEARCH_TEXT.EMPTY_BAR });
    }
  }

  /** A removable scope chip: a facet-colour dot, an inferred home glyph, the name, and a remove control. */
  private buildScopeChip(bar: HTMLElement, key: SearchFacetKey, value: string): void {
    const chip = bar.createDiv({ cls: CSS_CLS.PM_SEARCH_CHIP, attr: { [DOM_ATTR.DATA_FACET]: key } });
    this.paintDot(chip, CSS_CLS.PM_SEARCH_CHIP_DOT, ENTITY_FAMILY_COLOR_TOKEN[SEARCH_FACET_ENTITY_TYPE[key]]);
    if (this.inferred.has(inferredKey(key, value))) {
      const home = chip.createSpan({
        cls: CSS_CLS.PM_SEARCH_CHIP_HOME,
        attr: { [DOM_ATTR.ARIA_HIDDEN]: ARIA_BOOL.TRUE },
      });
      setIcon(home, PM_SEARCH_GLYPH.HOME);
    }
    chip.createSpan({ cls: CSS_CLS.PM_SEARCH_CHIP_LABEL, text: value });
    const remove = chip.createEl(HTML_TAG.BUTTON, {
      cls: CSS_CLS.PM_SEARCH_CHIP_REMOVE,
      attr: { [DOM_ATTR.ARIA_LABEL]: PM_SEARCH_TEXT.scopeChipRemoveAria(value) },
    });
    setIcon(remove, PM_SEARCH_GLYPH.CHIP_REMOVE);
    remove.addEventListener(DOM_EVENT.CLICK, () => this.onRemoveScopeChip(key, value));
  }

  /** A removable chip for one enabled type: a family-colour dot, its label, and a remove control. */
  private buildTypeChip(bar: HTMLElement, type: EntityType): void {
    const presentation = ENTITY_PRESENTATION[type];
    const chip = bar.createDiv({
      cls: CSS_CLS.PM_SEARCH_CHIP,
      attr: { [DOM_ATTR.DATA_ENTITY_TYPE]: type },
    });
    this.buildFamilyDot(chip, CSS_CLS.PM_SEARCH_CHIP_DOT, presentation);
    chip.createSpan({ cls: CSS_CLS.PM_SEARCH_CHIP_LABEL, text: presentation.label });
    const remove = chip.createEl(HTML_TAG.BUTTON, {
      cls: CSS_CLS.PM_SEARCH_CHIP_REMOVE,
      attr: { [DOM_ATTR.ARIA_LABEL]: PM_SEARCH_TEXT.typeChipRemoveAria(presentation.label) },
    });
    setIcon(remove, PM_SEARCH_GLYPH.CHIP_REMOVE);
    remove.addEventListener(DOM_EVENT.CLICK, () => this.onRemoveType(type));
  }

  /** Enabled types in registration order (stable and independent of toggle DOM). */
  private activeChipTypes(): EntityType[] {
    return ALL_ENTITY_TYPES.filter((type) => this.state.typeFilter.has(type));
  }

  /** A decorative family-colour dot from a presentation descriptor. */
  private buildFamilyDot(parent: HTMLElement, cls: string, presentation: EntityPresentation): void {
    this.paintDot(parent, cls, presentation.familyColorToken);
  }

  /** Paints a decorative dot, threading a family-colour token through an inline custom property. */
  private paintDot(parent: HTMLElement, cls: string, colorToken: string): void {
    const dot = parent.createSpan({ cls, attr: { [DOM_ATTR.ARIA_HIDDEN]: ARIA_BOOL.TRUE } });
    dot.style.setProperty(PM_SEARCH_DOT_VAR, cssVar(colorToken));
  }

  private destroyChipSelects(): void {
    for (const chipSelect of this.facetChipSelects.values()) chipSelect.destroy();
    this.facetChipSelects.clear();
  }

  // ─── Repaint (count + results) ───────────────────────────────────────────────

  private repaint(): void {
    const dataviewAvailable = this.services.getDv() !== null;
    const results = this.services.searchService.search(
      this.query,
      scopeOf(this.state),
      activeTypesOf(this.state)
    );
    this.renderCount(dataviewAvailable, results.length);
    this.renderResults(dataviewAvailable, results);
  }

  private renderCount(dataviewAvailable: boolean, count: number): void {
    this.countEl.setText(
      dataviewAvailable ? PM_SEARCH_TEXT.resultCount(count) : PM_SEARCH_TEXT.COUNT_UNAVAILABLE
    );
  }

  private renderResults(dataviewAvailable: boolean, results: SearchResult[]): void {
    this.resultsEl.empty();
    if (!dataviewAvailable) {
      this.buildDataviewAbsentState();
      return;
    }
    if (results.length > 0) {
      // Compile the query's highlighter once per repaint and reuse it across
      // rows (an empty query browses without highlighting).
      const highlighter = this.query.length > 0 ? prepareFuzzySearch(this.query) : null;
      for (const result of results) this.buildResultRow(result, highlighter);
      return;
    }
    // A non-empty query that matches nothing gets the no-match state; an empty
    // query over an empty vault simply shows no rows (browse mode, nothing yet).
    if (this.query.length > 0) this.buildNoMatchState();
  }

  // ─── Result row ──────────────────────────────────────────────────────────────

  private buildResultRow(result: SearchResult, highlighter: FuzzyHighlighter | null): void {
    const presentation = ENTITY_PRESENTATION[result.type];
    const row = this.resultsEl.createEl(HTML_TAG.BUTTON, { cls: CSS_CLS.PM_SEARCH_RESULT });
    this.buildRowIcon(row, presentation);
    const main = row.createDiv({ cls: CSS_CLS.PM_SEARCH_RESULT_MAIN });
    this.buildRowName(main, result.page.file.name, highlighter);
    this.buildRowBreadcrumb(main, result);
    this.buildRowTypePill(row, presentation);
    row.addEventListener(DOM_EVENT.CLICK, () => this.openResult(result.page));
  }

  /** Family-tinted icon gutter: the family token drives both the tint and the glyph stroke. */
  private buildRowIcon(row: HTMLElement, presentation: EntityPresentation): void {
    const gutter = row.createDiv({ cls: CSS_CLS.PM_SEARCH_RESULT_ICON });
    gutter.style.setProperty(PM_SEARCH_FAMILY_VAR, cssVar(presentation.familyColorToken));
    setIcon(gutter, presentation.icon);
  }

  /** Name with fuzzy-matched characters wrapped in `.hl`; an empty query yields no highlight. */
  private buildRowName(main: HTMLElement, name: string, highlighter: FuzzyHighlighter | null): void {
    const nameEl = main.createDiv({ cls: CSS_CLS.PM_SEARCH_RESULT_NAME });
    const matches = highlighter ? highlighter(name)?.matches ?? [] : [];
    if (matches.length === 0) {
      nameEl.setText(name);
      return;
    }
    let cursor = 0;
    for (const [start, end] of matches) {
      if (start > cursor) nameEl.appendChild(document.createTextNode(name.slice(cursor, start)));
      nameEl.createSpan({ cls: CSS_CLS.PM_SEARCH_HL, text: name.slice(start, end) });
      cursor = end;
    }
    if (cursor < name.length) nameEl.appendChild(document.createTextNode(name.slice(cursor)));
  }

  private buildRowTypePill(row: HTMLElement, presentation: EntityPresentation): void {
    row.createSpan({ cls: CSS_CLS.PM_SEARCH_RESULT_TYPE, text: presentation.label });
  }

  /** Client › Engagement breadcrumb; references with neither read "Knowledge base". */
  private buildRowBreadcrumb(main: HTMLElement, result: SearchResult): void {
    const segments = this.breadcrumbSegments(result);
    if (segments.length === 0) return;
    const crumb = main.createDiv({ cls: CSS_CLS.PM_SEARCH_CRUMB });
    segments.forEach((segment, index) => {
      if (index > 0) {
        crumb.createSpan({ cls: CSS_CLS.PM_SEARCH_CRUMB_SEP, text: PM_SEARCH_TEXT.CRUMB_SEPARATOR });
      }
      crumb.createSpan({ text: segment });
    });
  }

  private breadcrumbSegments(result: SearchResult): string[] {
    const segments: string[] = [];
    if (result.client) segments.push(result.client);
    if (result.engagement) segments.push(result.engagement);
    if (segments.length === 0 && KNOWLEDGE_BASE_TYPES.has(result.type)) {
      segments.push(PM_SEARCH_TEXT.CRUMB_KNOWLEDGE_BASE);
    }
    return segments;
  }

  // ─── Empty states ────────────────────────────────────────────────────────────

  private buildNoMatchState(): void {
    this.buildEmptyState(
      PM_SEARCH_GLYPH.NO_MATCH,
      PM_SEARCH_TEXT.noMatchTitle(this.query),
      PM_SEARCH_TEXT.NO_MATCH_LINE
    );
  }

  private buildDataviewAbsentState(): void {
    this.buildEmptyState(
      PM_SEARCH_GLYPH.DATAVIEW_OFF,
      PM_SEARCH_TEXT.DATAVIEW_TITLE,
      PM_SEARCH_TEXT.DATAVIEW_LINE
    );
  }

  private buildEmptyState(glyph: string, title: string, line: string): void {
    const empty = this.resultsEl.createDiv({ cls: CSS_CLS.PM_SEARCH_EMPTY });
    const icon = empty.createDiv({ cls: CSS_CLS.PM_SEARCH_EMPTY_ICON });
    setIcon(icon, glyph);
    empty.createDiv({ cls: CSS_CLS.PM_SEARCH_EMPTY_TITLE, text: title });
    empty.createDiv({ cls: CSS_CLS.PM_SEARCH_EMPTY_LINE, text: line });
  }

  // ─── Open-on-select ──────────────────────────────────────────────────────────

  private openResult(page: DataviewPage): void {
    const file = this.services.app.vault.getAbstractFileByPath(page.file.path);
    if (file instanceof TFile) {
      void this.services.navigationService
        .openFile(file)
        .catch((err) => this.services.loggerService.error(String(err), LOG_CONTEXT.PM_SEARCH_VIEW, err));
    }
  }
}
