import { TFile, prepareFuzzySearch, setIcon } from "obsidian";
import type { SearchViewServices } from "../plugin-context";
import type { DashboardViewComponent } from "../processors/dashboard-render-child";
import { ENTITY_PRESENTATION } from "../entity-registry";
import type { EntityPresentation } from "../entity-registry";
import { cssVar } from "../processors/dom-helpers";
import { debounced } from "../utils/debounce";
import type { Debounced } from "../utils/debounce";
import type { DataviewPage, EntityType, SearchResult, SearchScope } from "../types";
import {
  ALL_ENTITY_TYPES,
  CSS_CLS,
  CSS_DISPLAY,
  DEBOUNCE_MS,
  DOM_ATTR,
  DOM_EVENT,
  ENTITY_TYPE,
  HTML_TAG,
  INPUT_TYPE,
  LOG_CONTEXT,
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
 * The search panel's view component: a fuzzy search box, a right-aligned count
 * row, and a ranked results list, all wired to {@link SearchViewServices}. It
 * holds the query, debounces input, and repaints the count and results on each
 * quiet window; row label / icon / family colour come solely from
 * {@link ENTITY_PRESENTATION} (registry-driven, no per-type branches). Selecting
 * a row opens the underlying file through the navigation service. An empty query
 * browses every entity with no highlighting; an absent Dataview renders a
 * dedicated state and never throws.
 */
export class PmSearchView implements DashboardViewComponent {
  private query = "";
  private inputEl!: HTMLInputElement;
  private clearBtn!: HTMLButtonElement;
  private countEl!: HTMLElement;
  private resultsEl!: HTMLElement;
  private readonly search: Debounced = debounced(() => this.repaint(), DEBOUNCE_MS.SEARCH);

  constructor(
    private readonly container: HTMLElement,
    private readonly services: SearchViewServices
  ) {}

  render(): void {
    this.container.empty();
    const root = this.container.createDiv({ cls: CSS_CLS.PM_SEARCH });
    const commandZone = root.createDiv({ cls: CSS_CLS.PM_SEARCH_COMMAND_ZONE });
    this.buildSearchBox(commandZone);
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

  // ─── Repaint (count + results) ───────────────────────────────────────────────

  private repaint(): void {
    const dataviewAvailable = this.services.getDv() !== null;
    const results = this.services.searchService.search(this.query, NO_SCOPE, ALL_ENTITY_TYPES);
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
