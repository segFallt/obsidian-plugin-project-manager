import { TFile, prepareFuzzySearch, setIcon } from "obsidian";
import type { SearchViewServices } from "../plugin-context";
import type { DashboardViewComponent } from "../processors/dashboard-render-child";
import { ENTITY_PRESENTATION, ENTITY_FAMILY_GROUPS } from "../entity-registry";
import type { EntityPresentation, EntityFamilyGroup } from "../entity-registry";
import { cssVar } from "../processors/dom-helpers";
import { debounced } from "../utils/debounce";
import type { Debounced } from "../utils/debounce";
import type { DataviewPage, EntityType, SearchResult, SearchScope } from "../types";
import {
  ALL_ENTITY_TYPES,
  ARIA_BOOL,
  CSS_CLS,
  CSS_DISPLAY,
  DEBOUNCE_MS,
  DOM_ATTR,
  DOM_EVENT,
  ENTITY_FAMILY_LABEL,
  ENTITY_TYPE,
  HTML_TAG,
  INPUT_TYPE,
  LOG_CONTEXT,
  PM_SEARCH_DOT_VAR,
  PM_SEARCH_FAMILY_VAR,
  PM_SEARCH_GLYPH,
  PM_SEARCH_TEXT,
} from "../constants";

/** A query compiled once per repaint, then applied to each row's name for match highlighting. */
type FuzzyHighlighter = ReturnType<typeof prepareFuzzySearch>;

/** Empty scope — this panel applies no hierarchy/person constraint. */
const NO_SCOPE: SearchScope = {};

/** Types whose breadcrumb reads "Knowledge base" when no client/engagement resolves. */
const KNOWLEDGE_BASE_TYPES = new Set<EntityType>([ENTITY_TYPE.REFERENCE, ENTITY_TYPE.REFERENCE_TOPIC]);

/**
 * In-memory filter state driving the search. The type filter is the set of
 * {@link EntityType}s results narrow to; an empty set means every type. Held as
 * a plain seam so scope facets can be added and the whole state persisted later.
 */
interface SearchState {
  typeFilter: Set<EntityType>;
}

/**
 * The search panel's view component: a fuzzy search box, a filter zone (a drawer
 * toggle button, an active-scope chips bar, and a collapsible drawer of
 * family-grouped entity-type toggles), a right-aligned count row, and a ranked
 * results list, all wired to {@link SearchViewServices}. It holds the query and
 * the type filter, debounces input, and repaints on each change; results narrow
 * to the selected types (or every type when none are selected). Each toggle and
 * its active-scope chip drive the one `SearchState.typeFilter` and stay in sync.
 * Row and toggle label / icon / family colour come solely from
 * {@link ENTITY_PRESENTATION}, and the family grouping from
 * {@link ENTITY_FAMILY_GROUPS} (registry-driven, no per-type branches). Selecting
 * a row opens the underlying file through the navigation service. An empty query
 * browses every entity with no highlighting; an absent Dataview renders a
 * dedicated state and never throws.
 */
export class PmSearchView implements DashboardViewComponent {
  private query = "";
  private readonly state: SearchState = { typeFilter: new Set<EntityType>() };
  private inputEl!: HTMLInputElement;
  private clearBtn!: HTMLButtonElement;
  private filterBtnEl!: HTMLButtonElement;
  private drawerEl!: HTMLElement;
  private chipsBarEl!: HTMLElement;
  private countEl!: HTMLElement;
  private resultsEl!: HTMLElement;
  private drawerOpen = false;
  private readonly typeToggleEls = new Map<EntityType, HTMLButtonElement>();
  private readonly search: Debounced = debounced(() => this.repaint(), DEBOUNCE_MS.SEARCH);

  constructor(
    private readonly container: HTMLElement,
    private readonly services: SearchViewServices
  ) {}

  render(): void {
    this.container.empty();
    this.typeToggleEls.clear();
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
    this.typeToggleEls.clear();
    this.container.empty();
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

  // ─── Filter zone (button + chips bar + drawer) ───────────────────────────────

  private buildFilterZone(commandZone: HTMLElement): void {
    const zone = commandZone.createDiv({ cls: CSS_CLS.PM_SEARCH_FILTER_ZONE });
    this.buildFilterButton(zone);
    this.buildActiveChipsBar(zone);
    this.buildDrawer(zone);
  }

  /** The drawer toggle: a filter glyph, a label, and a chevron that rotates when open. */
  private buildFilterButton(zone: HTMLElement): void {
    this.filterBtnEl = zone.createEl(HTML_TAG.BUTTON, {
      cls: CSS_CLS.PM_SEARCH_FILTER_BTN,
      attr: {
        [DOM_ATTR.ARIA_LABEL]: PM_SEARCH_TEXT.FILTER_ARIA,
        [DOM_ATTR.ARIA_EXPANDED]: ARIA_BOOL.FALSE,
      },
    });
    const icon = this.filterBtnEl.createSpan({ cls: CSS_CLS.PM_SEARCH_FILTER_BTN_ICON });
    setIcon(icon, PM_SEARCH_GLYPH.FILTER);
    this.filterBtnEl.createSpan({ cls: CSS_CLS.PM_SEARCH_FILTER_BTN_LABEL, text: PM_SEARCH_TEXT.FILTER_BTN });
    const chevron = this.filterBtnEl.createSpan({ cls: CSS_CLS.PM_SEARCH_FILTER_BTN_CHEVRON });
    setIcon(chevron, PM_SEARCH_GLYPH.CHEVRON);
    this.filterBtnEl.addEventListener(DOM_EVENT.CLICK, () => this.setDrawerOpen(!this.drawerOpen));
  }

  /** Reflects the open state on the button (`aria-expanded`) and the drawer (open modifier). */
  private setDrawerOpen(open: boolean): void {
    this.drawerOpen = open;
    this.filterBtnEl.setAttribute(DOM_ATTR.ARIA_EXPANDED, open ? ARIA_BOOL.TRUE : ARIA_BOOL.FALSE);
    this.drawerEl.classList.toggle(CSS_CLS.PM_SEARCH_DRAWER_OPEN, open);
  }

  /** The collapsible drawer; holds the type toggles and is the seam scope facets extend. */
  private buildDrawer(zone: HTMLElement): void {
    this.drawerEl = zone.createDiv({ cls: CSS_CLS.PM_SEARCH_DRAWER });
    this.buildTypeToggleGroups(this.drawerEl);
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

  // ─── Active-scope chips bar ──────────────────────────────────────────────────

  private buildActiveChipsBar(zone: HTMLElement): void {
    this.chipsBarEl = zone.createDiv({ cls: CSS_CLS.PM_SEARCH_CHIPS });
    this.renderActiveChips();
  }

  private renderActiveChips(): void {
    this.chipsBarEl.empty();
    for (const type of this.activeChipTypes()) this.buildTypeChip(this.chipsBarEl, type);
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

  private onRemoveType(type: EntityType): void {
    this.state.typeFilter.delete(type);
    this.syncTypeControls();
  }

  // ─── Type-filter synchronisation ─────────────────────────────────────────────

  /** Mirrors the type filter across every toggle and the chips bar, then repaints results. */
  private syncTypeControls(): void {
    for (const [type, toggle] of this.typeToggleEls) {
      toggle.setAttribute(DOM_ATTR.ARIA_PRESSED, this.pressedValue(type));
    }
    this.renderActiveChips();
    this.repaint();
  }

  /** `aria-pressed` string for a type, driven by the shared filter set. */
  private pressedValue(type: EntityType): string {
    return this.state.typeFilter.has(type) ? ARIA_BOOL.TRUE : ARIA_BOOL.FALSE;
  }

  /** Enabled types in toggle order, so their chips read left-to-right like the drawer. */
  private activeChipTypes(): EntityType[] {
    return [...this.typeToggleEls.keys()].filter((type) => this.state.typeFilter.has(type));
  }

  /** The selected types, or every type when none are selected ("no filter = all"). */
  private activeTypes(): EntityType[] {
    if (this.state.typeFilter.size === 0) return ALL_ENTITY_TYPES;
    return ALL_ENTITY_TYPES.filter((type) => this.state.typeFilter.has(type));
  }

  /** A decorative family-colour dot; the colour is threaded through an inline custom property. */
  private buildFamilyDot(parent: HTMLElement, cls: string, presentation: EntityPresentation): void {
    const dot = parent.createSpan({ cls, attr: { [DOM_ATTR.ARIA_HIDDEN]: ARIA_BOOL.TRUE } });
    dot.style.setProperty(PM_SEARCH_DOT_VAR, cssVar(presentation.familyColorToken));
  }

  // ─── Repaint (count + results) ───────────────────────────────────────────────

  private repaint(): void {
    const dataviewAvailable = this.services.getDv() !== null;
    const results = this.services.searchService.search(this.query, NO_SCOPE, this.activeTypes());
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
