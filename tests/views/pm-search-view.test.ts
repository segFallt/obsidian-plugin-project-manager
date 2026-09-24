import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TFile } from "obsidian";
import { PmSearchView } from "@/views/pm-search-view";
import type { SearchViewServices } from "@/plugin-context";
import { SearchService } from "@/services/search-service";
import { EntityEnumerator } from "@/services/entity-enumerator";
import { EntityHierarchyService } from "@/services/entity-hierarchy-service";
import { PersonAssociationResolver } from "@/services/person-association-resolver";
import { PreparedFuzzyMatcher } from "@/services/prepared-fuzzy-matcher";
import { QueryService } from "@/services/query-service";
import { createMockDataviewApi, type MockPageData } from "../mocks/dataview-mock";
import {
  ALL_ENTITY_TYPES,
  ARIA_BOOL,
  CSS_CLS,
  DEFAULT_FOLDERS,
  DEBOUNCE_MS,
  DOM_ATTR,
  ENTITY_LABEL,
  ENTITY_TYPE,
  PM_SEARCH_TEXT,
  SEARCH_FACET_KEY,
} from "@/constants";
import type { EntityType, SavedSearchFilters } from "@/types";
import type { FolderSettings } from "@/settings";
import type { DataviewApi } from "@/types";

const folders = DEFAULT_FOLDERS as unknown as FolderSettings;

const VAULT: MockPageData[] = [
  { path: "clients/Acme.md", folder: "clients", tags: ["#client"] },
  { path: "clients/Apex Acme Ltd.md", folder: "clients", tags: ["#client"] },
  { path: "clients/Globex.md", folder: "clients", tags: ["#client"] },
  { path: "engagements/Acme Phase 1.md", folder: "engagements", tags: ["#engagement"], frontmatter: { client: "[[Acme]]" } },
  { path: "projects/Acme Portal.md", folder: "projects", tags: ["#project"], frontmatter: { engagement: "[[Acme Phase 1]]" } },
];

interface Harness {
  container: HTMLElement;
  services: SearchViewServices;
  openFile: ReturnType<typeof vi.fn>;
}

function makeHarness(
  pages: MockPageData[],
  getDv?: () => DataviewApi | null,
  options: { activeFilePath?: string } = {}
): Harness {
  const dv = createMockDataviewApi(pages);
  const resolvedGetDv = getDv ?? ((): DataviewApi | null => dv);
  const query = new QueryService(resolvedGetDv, folders);
  const enumerator = new EntityEnumerator(query);
  const hierarchyService = new EntityHierarchyService(resolvedGetDv, folders);
  const searchService = new SearchService({
    getDv: resolvedGetDv,
    enumerator,
    hierarchyService,
    personResolver: new PersonAssociationResolver(resolvedGetDv, folders),
    matcher: new PreparedFuzzyMatcher(),
  });

  const openFile = vi.fn().mockResolvedValue(undefined);
  const activeFile = options.activeFilePath ? new TFile(options.activeFilePath) : null;
  const services: SearchViewServices = {
    app: {
      vault: { getAbstractFileByPath: (path: string) => new TFile(path) },
      workspace: { getActiveFile: () => activeFile },
    } as unknown as SearchViewServices["app"],
    searchService,
    navigationService: { openFile },
    hierarchyService,
    enumerator,
    loggerService: {
      debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined), cleanOldLogs: vi.fn().mockResolvedValue(undefined),
    },
    getDv: resolvedGetDv,
  };

  return { container: document.createElement("div"), services, openFile };
}

/** Sets the query and flushes the debounce so the results repaint. */
function type(container: HTMLElement, text: string): void {
  const input = container.querySelector<HTMLInputElement>(`.${CSS_CLS.PM_SEARCH_INPUT_FIELD}`)!;
  input.value = text;
  input.dispatchEvent(new Event("input"));
  vi.advanceTimersByTime(DEBOUNCE_MS.SEARCH);
}

const rowNames = (container: HTMLElement): string[] =>
  [...container.querySelectorAll(`.${CSS_CLS.PM_SEARCH_RESULT_NAME}`)].map((el) => el.textContent ?? "");

const typeToggle = (container: HTMLElement, type: EntityType): HTMLButtonElement =>
  container.querySelector<HTMLButtonElement>(
    `.${CSS_CLS.PM_SEARCH_TTOG}[${DOM_ATTR.DATA_ENTITY_TYPE}="${type}"]`
  )!;

const typeChip = (container: HTMLElement, type: EntityType): HTMLElement | null =>
  container.querySelector<HTMLElement>(
    `.${CSS_CLS.PM_SEARCH_CHIP}[${DOM_ATTR.DATA_ENTITY_TYPE}="${type}"]`
  );

describe("PmSearchView", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders fuzzy results best-first with matched characters highlighted", () => {
    const { container, services } = makeHarness(VAULT);
    const view = new PmSearchView(container, services);
    view.render();

    type(container, "acme");

    // "Acme" is a contiguous, front-anchored match so it ranks first; the four
    // names containing a c-m-e subsequence all match, and Globex is excluded.
    const names = rowNames(container);
    expect(names[0]).toBe("Acme");
    expect(names).not.toContain("Globex");
    expect(names).toHaveLength(4);

    const firstRow = container.querySelector(`.${CSS_CLS.PM_SEARCH_RESULT_NAME}`)!;
    const highlighted = [...firstRow.querySelectorAll(`.${CSS_CLS.PM_SEARCH_HL}`)].map((el) => el.textContent);
    expect(highlighted.join("").toLowerCase()).toBe("acme");
  });

  it("shows a family-tinted icon, a type pill, and a Client › Engagement breadcrumb", () => {
    const { container, services } = makeHarness(VAULT);
    const view = new PmSearchView(container, services);
    view.render();

    type(container, "portal");

    const row = container.querySelector<HTMLElement>(`.${CSS_CLS.PM_SEARCH_RESULT}`)!;
    const iconGutter = row.querySelector<HTMLElement>(`.${CSS_CLS.PM_SEARCH_RESULT_ICON}`)!;
    expect(iconGutter.style.getPropertyValue("--pm-row-family")).toBe("var(--pm-entity-project)");
    expect(iconGutter.querySelector("svg")?.getAttribute("data-icon")).toBe("folder-kanban");

    const pill = row.querySelector(`.${CSS_CLS.PM_SEARCH_RESULT_TYPE}`);
    expect(pill?.textContent).toBe(ENTITY_LABEL[ENTITY_TYPE.PROJECT]);

    const crumb = row.querySelector(`.${CSS_CLS.PM_SEARCH_CRUMB}`);
    expect(crumb?.textContent).toContain("Acme");
    expect(crumb?.textContent).toContain("Acme Phase 1");
    expect(crumb?.querySelector(`.${CSS_CLS.PM_SEARCH_CRUMB_SEP}`)?.textContent).toBe(PM_SEARCH_TEXT.CRUMB_SEPARATOR);
  });

  it("opens the underlying file through NavigationService on select", () => {
    const { container, services, openFile } = makeHarness(VAULT);
    const view = new PmSearchView(container, services);
    view.render();

    type(container, "portal");
    container.querySelector<HTMLButtonElement>(`.${CSS_CLS.PM_SEARCH_RESULT}`)!.click();

    expect(openFile).toHaveBeenCalledTimes(1);
    expect(openFile.mock.calls[0][0]).toBeInstanceOf(TFile);
    expect(openFile.mock.calls[0][0].path).toBe("projects/Acme Portal.md");
  });

  it("renders the no-match state without throwing when a query matches nothing", () => {
    const { container, services } = makeHarness(VAULT);
    const view = new PmSearchView(container, services);
    view.render();

    expect(() => type(container, "zzzzz")).not.toThrow();
    expect(container.querySelectorAll(`.${CSS_CLS.PM_SEARCH_RESULT}`).length).toBe(0);
    const empty = container.querySelector(`.${CSS_CLS.PM_SEARCH_EMPTY}`);
    expect(empty?.querySelector(`.${CSS_CLS.PM_SEARCH_EMPTY_TITLE}`)?.textContent).toBe(
      PM_SEARCH_TEXT.noMatchTitle("zzzzz")
    );
  });

  it("renders the Dataview-absent state without throwing when getDv is null", () => {
    const { container, services } = makeHarness(VAULT, () => null);
    const view = new PmSearchView(container, services);
    expect(() => view.render()).not.toThrow();

    expect(container.querySelectorAll(`.${CSS_CLS.PM_SEARCH_RESULT}`).length).toBe(0);
    expect(container.querySelector(`.${CSS_CLS.PM_SEARCH_COUNT}`)?.textContent).toBe(
      PM_SEARCH_TEXT.COUNT_UNAVAILABLE
    );
    const empty = container.querySelector(`.${CSS_CLS.PM_SEARCH_EMPTY}`);
    expect(empty?.querySelector(`.${CSS_CLS.PM_SEARCH_EMPTY_TITLE}`)?.textContent).toBe(
      PM_SEARCH_TEXT.DATAVIEW_TITLE
    );
  });

  it("narrows the search to a single type when one toggle is enabled", () => {
    const { container, services } = makeHarness(VAULT);
    const searchSpy = vi.spyOn(services.searchService, "search");
    const view = new PmSearchView(container, services);
    view.render();

    typeToggle(container, ENTITY_TYPE.CLIENT).click();

    // The search is re-run with only the selected type, and the browse results
    // restrict to the three client notes (the engagement/project drop out).
    expect(searchSpy.mock.calls.at(-1)?.[2]).toEqual([ENTITY_TYPE.CLIENT]);
    const names = rowNames(container);
    expect(names).toHaveLength(3);
    expect(names).toContain("Acme");
    expect(names).not.toContain("Acme Phase 1");
  });

  it("narrows the search to exactly the enabled types when several toggles are pressed", () => {
    const { container, services } = makeHarness(VAULT);
    const searchSpy = vi.spyOn(services.searchService, "search");
    const view = new PmSearchView(container, services);
    view.render();

    typeToggle(container, ENTITY_TYPE.CLIENT).click();
    typeToggle(container, ENTITY_TYPE.PERSON).click();

    expect(searchSpy.mock.calls.at(-1)?.[2]).toEqual([ENTITY_TYPE.CLIENT, ENTITY_TYPE.PERSON]);
  });

  it("restores all types once the last type toggle is cleared", () => {
    const { container, services } = makeHarness(VAULT);
    const searchSpy = vi.spyOn(services.searchService, "search");
    const view = new PmSearchView(container, services);
    view.render();

    const toggle = typeToggle(container, ENTITY_TYPE.CLIENT);
    toggle.click(); // enable
    toggle.click(); // disable — back to "no filter = all"

    expect(searchSpy.mock.calls.at(-1)?.[2]).toEqual(ALL_ENTITY_TYPES);
  });

  it("keeps a toggle and its active-scope chip in sync", () => {
    const { container, services } = makeHarness(VAULT);
    const view = new PmSearchView(container, services);
    view.render();

    const toggle = typeToggle(container, ENTITY_TYPE.CLIENT);
    toggle.click();

    // Enabling the toggle presses it and adds a matching chip.
    expect(toggle.getAttribute(DOM_ATTR.ARIA_PRESSED)).toBe(ARIA_BOOL.TRUE);
    const chip = typeChip(container, ENTITY_TYPE.CLIENT);
    expect(chip).not.toBeNull();
    expect(chip?.textContent).toContain(ENTITY_LABEL[ENTITY_TYPE.CLIENT]);

    // Removing the chip un-presses the toggle and drops the chip.
    chip!.querySelector<HTMLButtonElement>(`.${CSS_CLS.PM_SEARCH_CHIP_REMOVE}`)!.click();
    expect(toggle.getAttribute(DOM_ATTR.ARIA_PRESSED)).toBe(ARIA_BOOL.FALSE);
    expect(typeChip(container, ENTITY_TYPE.CLIENT)).toBeNull();
  });

  it("opens and closes the filter drawer from the add button", () => {
    const { container, services } = makeHarness(VAULT);
    const view = new PmSearchView(container, services);
    view.render();

    const button = container.querySelector<HTMLButtonElement>(`.${CSS_CLS.PM_SEARCH_ADD}`)!;
    const drawer = container.querySelector<HTMLElement>(`.${CSS_CLS.PM_SEARCH_DRAWER}`)!;
    expect(button.getAttribute(DOM_ATTR.ARIA_EXPANDED)).toBe(ARIA_BOOL.FALSE);
    expect(drawer.classList.contains(CSS_CLS.PM_SEARCH_DRAWER_OPEN)).toBe(false);

    button.click();
    expect(button.getAttribute(DOM_ATTR.ARIA_EXPANDED)).toBe(ARIA_BOOL.TRUE);
    expect(drawer.classList.contains(CSS_CLS.PM_SEARCH_DRAWER_OPEN)).toBe(true);

    button.click();
    expect(button.getAttribute(DOM_ATTR.ARIA_EXPANDED)).toBe(ARIA_BOOL.FALSE);
    expect(drawer.classList.contains(CSS_CLS.PM_SEARCH_DRAWER_OPEN)).toBe(false);
  });

  it("shows the result count and clears cleanly on destroy", () => {
    const { container, services } = makeHarness(VAULT);
    const view = new PmSearchView(container, services);
    view.render();

    type(container, "acme");
    expect(container.querySelector(`.${CSS_CLS.PM_SEARCH_COUNT}`)?.textContent).toBe(
      PM_SEARCH_TEXT.resultCount(4)
    );

    view.destroy();
    expect(container.childElementCount).toBe(0);
  });
});

// ─── Scope facets + persistence ──────────────────────────────────────────

/** A vault where hierarchy scoping is meaningful (two client hierarchies + a person). */
const SCOPE_VAULT: MockPageData[] = [
  { path: "clients/Acme.md", folder: "clients", tags: ["#client"] },
  { path: "clients/Globex.md", folder: "clients", tags: ["#client"] },
  { path: "engagements/Acme Eng.md", folder: "engagements", tags: ["#engagement"], frontmatter: { client: "[[Acme]]" } },
  { path: "engagements/Globex Eng.md", folder: "engagements", tags: ["#engagement"], frontmatter: { client: "[[Globex]]" } },
  { path: "projects/Acme Proj.md", folder: "projects", tags: ["#project"], frontmatter: { engagement: "[[Acme Eng]]" } },
  { path: "projects/Globex Proj.md", folder: "projects", tags: ["#project"], frontmatter: { engagement: "[[Globex Eng]]" } },
  { path: "people/Alice.md", folder: "people", tags: ["#person"], frontmatter: { client: "[[Acme]]" } },
  { path: "raid/Acme Risk.md", folder: "raid", tags: ["#raid"], frontmatter: { engagement: "[[Acme Eng]]", owner: "[[Alice]]" } },
];

type FacetKey = (typeof SEARCH_FACET_KEY)[keyof typeof SEARCH_FACET_KEY];

/** Adds a facet value by focusing its type-ahead and picking the matching suggestion. */
function addFacetValue(container: HTMLElement, facet: FacetKey, displayText: string): void {
  const input = container.querySelector<HTMLInputElement>(
    `.${CSS_CLS.PM_SEARCH_FACET}[${DOM_ATTR.DATA_FACET}="${facet}"] .pm-autocomplete__input`
  )!;
  input.dispatchEvent(new FocusEvent("focus"));
  const option = [...input.parentElement!.querySelectorAll<HTMLElement>(".pm-autocomplete__option")].find(
    (el) => el.textContent === displayText
  )!;
  option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
}

const scopeChip = (container: HTMLElement, facet: FacetKey): HTMLElement[] =>
  [...container.querySelectorAll<HTMLElement>(`.${CSS_CLS.PM_SEARCH_CHIP}[${DOM_ATTR.DATA_FACET}="${facet}"]`)];

const lastScope = (spy: ReturnType<typeof vi.spyOn>): Record<string, string[]> =>
  (spy.mock.calls.at(-1)?.[1] ?? {}) as Record<string, string[]>;

describe("PmSearchView — scope facets, chips, auto-seed, persistence", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the empty-bar guidance when no filter is active", () => {
    const { container, services } = makeHarness(SCOPE_VAULT);
    new PmSearchView(container, services).render();
    expect(container.querySelector(`.${CSS_CLS.PM_SEARCH_CHIPS_EMPTY}`)?.textContent).toBe(
      PM_SEARCH_TEXT.EMPTY_BAR
    );
  });

  it("adds a chip per facet and passes the scope to the search", () => {
    const { container, services } = makeHarness(SCOPE_VAULT);
    const searchSpy = vi.spyOn(services.searchService, "search");
    new PmSearchView(container, services).render();

    addFacetValue(container, SEARCH_FACET_KEY.CLIENT, "Acme");
    addFacetValue(container, SEARCH_FACET_KEY.PERSON, "Alice");

    // A scope chip appears in the bar for each facet, and the search runs with
    // the AND-across-facets scope.
    expect(scopeChip(container, SEARCH_FACET_KEY.CLIENT)[0]?.textContent).toContain("Acme");
    expect(scopeChip(container, SEARCH_FACET_KEY.PERSON)[0]?.textContent).toContain("Alice");
    expect(lastScope(searchSpy)).toEqual({ clients: ["Acme"], people: ["Alice"] });
  });

  it("removes a scope chip from the bar and drops it from the scope", () => {
    const { container, services } = makeHarness(SCOPE_VAULT);
    const searchSpy = vi.spyOn(services.searchService, "search");
    new PmSearchView(container, services).render();

    addFacetValue(container, SEARCH_FACET_KEY.CLIENT, "Acme");
    scopeChip(container, SEARCH_FACET_KEY.CLIENT)[0]
      .querySelector<HTMLButtonElement>(`.${CSS_CLS.PM_SEARCH_CHIP_REMOVE}`)!
      .click();

    expect(scopeChip(container, SEARCH_FACET_KEY.CLIENT)).toHaveLength(0);
    expect(lastScope(searchSpy)).toEqual({});
  });

  it("ORs several values within a facet (union of both hierarchies)", () => {
    const { container, services } = makeHarness(SCOPE_VAULT);
    const searchSpy = vi.spyOn(services.searchService, "search");
    new PmSearchView(container, services).render();

    addFacetValue(container, SEARCH_FACET_KEY.CLIENT, "Acme");
    addFacetValue(container, SEARCH_FACET_KEY.CLIENT, "Globex");

    expect(lastScope(searchSpy)).toEqual({ clients: ["Acme", "Globex"] });
    // Both hierarchies' descendants survive: two engagements + two projects + one
    // person + one RAID item all resolve up to Acme or Globex (the bare client
    // notes resolve to no client of their own).
    expect(rowNames(container).sort()).toEqual(
      ["Acme Eng", "Acme Proj", "Acme Risk", "Alice", "Globex Eng", "Globex Proj"].sort()
    );
  });

  it("ANDs across facets (client AND person narrows to the intersection)", () => {
    const { container, services } = makeHarness(SCOPE_VAULT);
    new PmSearchView(container, services).render();

    addFacetValue(container, SEARCH_FACET_KEY.CLIENT, "Acme");
    addFacetValue(container, SEARCH_FACET_KEY.PERSON, "Alice");

    // Of the Acme-client entities, only Alice (self) and the RAID item she owns
    // are associated with Alice.
    expect(rowNames(container).sort()).toEqual(["Acme Risk", "Alice"].sort());
  });

  it("auto-seeds the active note's client and engagement as inferred chips", () => {
    const { container, services } = makeHarness(SCOPE_VAULT, undefined, {
      activeFilePath: "projects/Acme Proj.md",
    });
    const searchSpy = vi.spyOn(services.searchService, "search");
    new PmSearchView(container, services).render();

    const clientChip = scopeChip(container, SEARCH_FACET_KEY.CLIENT)[0];
    expect(clientChip?.textContent).toContain("Acme");
    // The inferred chip carries the home glyph.
    expect(clientChip?.querySelector(`.${CSS_CLS.PM_SEARCH_CHIP_HOME}`)).not.toBeNull();
    expect(lastScope(searchSpy)).toEqual({ clients: ["Acme"], engagements: ["Acme Eng"] });
  });

  it("persists the whole filter state and restores scope + types on reopen", () => {
    let saved: SavedSearchFilters | null = null;
    const first = makeHarness(SCOPE_VAULT);
    const view = new PmSearchView(first.container, first.services, null, (f) => { saved = f; });
    view.render();

    addFacetValue(first.container, SEARCH_FACET_KEY.CLIENT, "Acme");
    typeToggle(first.container, ENTITY_TYPE.CLIENT).click();

    expect(saved).toEqual({ clients: ["Acme"], engagements: [], people: [], types: [ENTITY_TYPE.CLIENT] });

    // Reopen a fresh panel seeded with the persisted state.
    const second = makeHarness(SCOPE_VAULT);
    const restoreSpy = vi.spyOn(second.services.searchService, "search");
    new PmSearchView(second.container, second.services, saved).render();

    expect(scopeChip(second.container, SEARCH_FACET_KEY.CLIENT)[0]?.textContent).toContain("Acme");
    expect(typeChip(second.container, ENTITY_TYPE.CLIENT)).not.toBeNull();
    expect(lastScope(restoreSpy)).toEqual({ clients: ["Acme"] });
    expect(restoreSpy.mock.calls.at(-1)?.[2]).toEqual([ENTITY_TYPE.CLIENT]);
  });

  it("restores defensively when a persisted sub-key is missing (deep-merge gotcha)", () => {
    const { container, services } = makeHarness(SCOPE_VAULT);
    const searchSpy = vi.spyOn(services.searchService, "search");
    // engagements / people / types absent — as after a settings upgrade replaced
    // the whole savedSearchFilters object.
    const partial = { clients: ["Acme"] } as SavedSearchFilters;

    expect(() => new PmSearchView(container, services, partial).render()).not.toThrow();
    expect(scopeChip(container, SEARCH_FACET_KEY.CLIENT)[0]?.textContent).toContain("Acme");
    expect(lastScope(searchSpy)).toEqual({ clients: ["Acme"] });
  });

  it("clears every scope facet and type toggle from the Clear button", () => {
    const { container, services } = makeHarness(SCOPE_VAULT);
    const searchSpy = vi.spyOn(services.searchService, "search");
    new PmSearchView(container, services).render();

    addFacetValue(container, SEARCH_FACET_KEY.CLIENT, "Acme");
    typeToggle(container, ENTITY_TYPE.CLIENT).click();

    const clearBtn = container.querySelector<HTMLButtonElement>(`.${CSS_CLS.PM_SEARCH_CLEAR_FILTERS}`)!;
    expect(clearBtn.style.display).not.toBe("none");
    clearBtn.click();

    expect(scopeChip(container, SEARCH_FACET_KEY.CLIENT)).toHaveLength(0);
    expect(typeChip(container, ENTITY_TYPE.CLIENT)).toBeNull();
    expect(lastScope(searchSpy)).toEqual({});
    expect(clearBtn.style.display).toBe("none");
  });
});
