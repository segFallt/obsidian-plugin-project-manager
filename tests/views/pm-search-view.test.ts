import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TFile } from "obsidian";
import { PmSearchView } from "@/views/pm-search-view";
import type { SearchViewServices } from "@/plugin-context";
import { SearchService } from "@/services/search-service";
import { EntityEnumerator } from "@/services/entity-enumerator";
import { EntityHierarchyService } from "@/services/entity-hierarchy-service";
import { PersonAssociationResolver } from "@/services/person-association-resolver";
import { SubstringMatcher } from "@/services/substring-matcher";
import type { ITextMatcher, SearchField } from "@/services/matcher";
import { QueryService } from "@/services/query-service";
import type { IContentProvider } from "@/services/content-provider";
import { createMockDataviewApi, createMockPage, type MockPageData } from "../mocks/dataview-mock";
import {
  ALL_ENTITY_TYPES,
  ARIA_BOOL,
  CSS_CLS,
  CSS_DISPLAY,
  DEFAULT_FOLDERS,
  DEBOUNCE_MS,
  DOM_ATTR,
  EMPTY_QUERY,
  ENTITY_LABEL,
  ENTITY_TYPE,
  MATCH_FIELD,
  PM_SEARCH_TEXT,
  SEARCH_FACET_KEY,
} from "@/constants";
import type { EntityType, SavedSearchFilters, SearchResult } from "@/types";
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

/** A query of only whitespace: non-empty as typed, but browse mode once normalized. */
const WHITESPACE_ONLY_QUERY = "   ";

interface Harness {
  container: HTMLElement;
  services: SearchViewServices;
  openFile: ReturnType<typeof vi.fn>;
}

function makeHarness(
  pages: MockPageData[],
  getDv?: () => DataviewApi | null,
  options: { activeFilePath?: string; bodies?: Record<string, string>; nameMatcher?: ITextMatcher } = {}
): Harness {
  const dv = createMockDataviewApi(pages);
  const resolvedGetDv = getDv ?? ((): DataviewApi | null => dv);
  const query = new QueryService(resolvedGetDv, folders);
  const enumerator = new EntityEnumerator(query);
  const hierarchyService = new EntityHierarchyService(resolvedGetDv, folders);
  const contentProvider: IContentProvider = {
    textFor: async (page) => options.bodies?.[page.file.path] ?? "",
  };
  const fields: readonly SearchField[] = [
    { field: MATCH_FIELD.NAME, matcher: options.nameMatcher ?? new SubstringMatcher(), buildsSnippet: false },
    { field: MATCH_FIELD.BODY, matcher: new SubstringMatcher(), buildsSnippet: true },
  ];
  const searchService = new SearchService({
    getDv: resolvedGetDv,
    enumerator,
    hierarchyService,
    personResolver: new PersonAssociationResolver(resolvedGetDv, folders),
    contentProvider,
    fields,
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

/** Drains the microtasks the async repaint queues (the search + paint) under fake timers. */
async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

/** Sets the query, flushes the debounce so the search fires, then drains the async repaint. */
async function type(container: HTMLElement, text: string): Promise<void> {
  const input = container.querySelector<HTMLInputElement>(`.${CSS_CLS.PM_SEARCH_INPUT_FIELD}`)!;
  input.value = text;
  input.dispatchEvent(new Event("input"));
  vi.advanceTimersByTime(DEBOUNCE_MS.SEARCH);
  await flush();
}

const rowNames = (container: HTMLElement): string[] =>
  [...container.querySelectorAll(`.${CSS_CLS.PM_SEARCH_RESULT_NAME}`)].map((el) => el.textContent ?? "");

/** The highlighted runs' text in the name element of the row whose name is `name`. */
function nameHighlights(container: HTMLElement, name: string): string[] {
  const nameEl = [...container.querySelectorAll(`.${CSS_CLS.PM_SEARCH_RESULT_NAME}`)].find(
    (el) => el.textContent === name
  )!;
  return [...nameEl.querySelectorAll(`.${CSS_CLS.PM_SEARCH_HL}`)].map((el) => el.textContent ?? "");
}

const emptyTitle = (container: HTMLElement): string | null | undefined =>
  container.querySelector(`.${CSS_CLS.PM_SEARCH_EMPTY} .${CSS_CLS.PM_SEARCH_EMPTY_TITLE}`)?.textContent;

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

  it("renders name matches best-first with the matched substring highlighted once per row", async () => {
    const { container, services } = makeHarness(VAULT);
    const view = new PmSearchView(container, services);
    view.render();

    await type(container, "acme");

    // "Acme" matches at the start of the name so it ranks first; the four names
    // containing "acme" all match, and Globex is excluded.
    const names = rowNames(container);
    expect(names[0]).toBe("Acme");
    expect(names).not.toContain("Globex");
    expect(names).toHaveLength(4);

    // Every name row highlights exactly one run: the query's occurrence in the name.
    const nameRows = [...container.querySelectorAll(`.${CSS_CLS.PM_SEARCH_RESULT_NAME}`)];
    for (const row of nameRows) {
      const highlighted = [...row.querySelectorAll(`.${CSS_CLS.PM_SEARCH_HL}`)].map((el) => el.textContent ?? "");
      expect(highlighted).toHaveLength(1);
      expect(highlighted[0].toLowerCase()).toBe("acme");
    }
  });

  it("highlights only the mid-name occurrence of the query", async () => {
    const { container, services } = makeHarness(VAULT);
    new PmSearchView(container, services).render();

    await type(container, "acme");

    expect(nameHighlights(container, "Apex Acme Ltd")).toEqual(["Acme"]);
  });

  it("highlights only the first occurrence when the name contains the query twice", async () => {
    const { container, services } = makeHarness([
      { path: "projects/Acme – ACME Renewal.md", folder: "projects", tags: ["#project"] },
    ]);
    new PmSearchView(container, services).render();

    await type(container, "acme");

    expect(nameHighlights(container, "Acme – ACME Renewal")).toEqual(["Acme"]);
  });

  it("highlights every run the name matcher reports", async () => {
    // A stub matcher reporting both occurrences stands in for an all-occurrence matcher.
    const bothRuns: ITextMatcher = {
      prepare: () => (text) => (text === "Acme – ACME Renewal" ? { score: 0, matches: [[0, 4], [7, 11]] } : null),
    };
    const { container, services } = makeHarness(
      [{ path: "projects/Acme – ACME Renewal.md", folder: "projects", tags: ["#project"] }],
      undefined,
      { nameMatcher: bothRuns }
    );
    new PmSearchView(container, services).render();

    await type(container, "acme");

    expect(nameHighlights(container, "Acme – ACME Renewal")).toEqual(["Acme", "ACME"]);
  });

  it("shows the browse list, not the no-match state, for a whitespace-only query", async () => {
    const { container, services } = makeHarness(VAULT);
    new PmSearchView(container, services).render();

    await type(container, WHITESPACE_ONLY_QUERY);

    expect(rowNames(container)).toEqual(["Acme", "Acme Phase 1", "Acme Portal", "Apex Acme Ltd", "Globex"]);
    expect(container.querySelector(`.${CSS_CLS.PM_SEARCH_EMPTY}`)).toBeNull();
    // The clear button still shows, because the field is not empty.
    const clearBtn = container.querySelector<HTMLButtonElement>(`.${CSS_CLS.PM_SEARCH_CLEAR}`)!;
    expect(clearBtn.style.display).not.toBe(CSS_DISPLAY.NONE);
  });

  it("shows neither rows nor the no-match state for a whitespace-only query with nothing in scope", async () => {
    const { container, services } = makeHarness([]);
    new PmSearchView(container, services).render();

    await type(container, WHITESPACE_ONLY_QUERY);

    expect(container.querySelectorAll(`.${CSS_CLS.PM_SEARCH_RESULT}`)).toHaveLength(0);
    expect(container.querySelector(`.${CSS_CLS.PM_SEARCH_EMPTY}`)).toBeNull();
  });

  it("echoes the trimmed query in the no-match title", async () => {
    const { container, services } = makeHarness(VAULT);
    new PmSearchView(container, services).render();

    await type(container, "  zzzzz  ");

    expect(emptyTitle(container)).toBe(PM_SEARCH_TEXT.noMatchTitle("zzzzz"));
  });

  it("hides the clear button and browses again after the clear button is pressed", async () => {
    const { container, services } = makeHarness(VAULT);
    new PmSearchView(container, services).render();

    await type(container, "zzzzz");
    const clearBtn = container.querySelector<HTMLButtonElement>(`.${CSS_CLS.PM_SEARCH_CLEAR}`)!;
    clearBtn.click();
    await flush();

    expect(clearBtn.style.display).toBe(CSS_DISPLAY.NONE);
    expect(container.querySelector<HTMLInputElement>(`.${CSS_CLS.PM_SEARCH_INPUT_FIELD}`)!.value).toBe(EMPTY_QUERY);
    expect(rowNames(container)).toHaveLength(VAULT.length);
  });

  it("shows a family-tinted icon, a type pill, and a Client › Engagement breadcrumb", async () => {
    const { container, services } = makeHarness(VAULT);
    const view = new PmSearchView(container, services);
    view.render();

    await type(container, "portal");

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

  it("opens the underlying file through NavigationService on select", async () => {
    const { container, services, openFile } = makeHarness(VAULT);
    const view = new PmSearchView(container, services);
    view.render();

    await type(container, "portal");
    container.querySelector<HTMLButtonElement>(`.${CSS_CLS.PM_SEARCH_RESULT}`)!.click();

    expect(openFile).toHaveBeenCalledTimes(1);
    expect(openFile.mock.calls[0][0]).toBeInstanceOf(TFile);
    expect(openFile.mock.calls[0][0].path).toBe("projects/Acme Portal.md");
  });

  it("renders the no-match state without throwing when a query matches nothing", async () => {
    const { container, services } = makeHarness(VAULT);
    const view = new PmSearchView(container, services);
    view.render();

    await type(container, "zzzzz");

    expect(container.querySelectorAll(`.${CSS_CLS.PM_SEARCH_RESULT}`).length).toBe(0);
    const empty = container.querySelector(`.${CSS_CLS.PM_SEARCH_EMPTY}`);
    expect(empty?.querySelector(`.${CSS_CLS.PM_SEARCH_EMPTY_TITLE}`)?.textContent).toBe(
      PM_SEARCH_TEXT.noMatchTitle("zzzzz")
    );
  });

  it("renders the Dataview-absent state without throwing when getDv is null", async () => {
    const { container, services } = makeHarness(VAULT, () => null);
    const view = new PmSearchView(container, services);
    expect(() => view.render()).not.toThrow();
    await flush();

    expect(container.querySelectorAll(`.${CSS_CLS.PM_SEARCH_RESULT}`).length).toBe(0);
    expect(container.querySelector(`.${CSS_CLS.PM_SEARCH_COUNT}`)?.textContent).toBe(
      PM_SEARCH_TEXT.COUNT_UNAVAILABLE
    );
    const empty = container.querySelector(`.${CSS_CLS.PM_SEARCH_EMPTY}`);
    expect(empty?.querySelector(`.${CSS_CLS.PM_SEARCH_EMPTY_TITLE}`)?.textContent).toBe(
      PM_SEARCH_TEXT.DATAVIEW_TITLE
    );
  });

  it("narrows the search to a single type when one toggle is enabled", async () => {
    const { container, services } = makeHarness(VAULT);
    const searchSpy = vi.spyOn(services.searchService, "search");
    const view = new PmSearchView(container, services);
    view.render();

    typeToggle(container, ENTITY_TYPE.CLIENT).click();
    await flush();

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

  it("shows the result count and clears cleanly on destroy", async () => {
    const { container, services } = makeHarness(VAULT);
    const view = new PmSearchView(container, services);
    view.render();

    await type(container, "acme");
    expect(container.querySelector(`.${CSS_CLS.PM_SEARCH_COUNT}`)?.textContent).toBe(
      PM_SEARCH_TEXT.resultCount(4)
    );

    view.destroy();
    expect(container.childElementCount).toBe(0);
  });
});

// ─── Content search: snippets, copy, concurrency ───────────────────────────

describe("PmSearchView — content search", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("labels the search box for name and content matching", () => {
    const { container, services } = makeHarness(VAULT);
    new PmSearchView(container, services).render();

    const input = container.querySelector<HTMLInputElement>(`.${CSS_CLS.PM_SEARCH_INPUT_FIELD}`)!;
    expect(input.getAttribute("placeholder")).toBe(PM_SEARCH_TEXT.PLACEHOLDER);
    expect(PM_SEARCH_TEXT.PLACEHOLDER.toLowerCase()).toContain("content");
  });

  it("renders a single highlighted snippet for a body-derived match", async () => {
    const { container, services } = makeHarness(
      [{ path: "clients/Zephyr.md", folder: "clients", tags: ["#client"] }],
      undefined,
      { bodies: { "clients/Zephyr.md": "the team chose pineapple this quarter" } }
    );
    new PmSearchView(container, services).render();

    await type(container, "pineapple");

    // The note surfaces via its body, and a single snippet line highlights the match.
    expect(rowNames(container)).toEqual(["Zephyr"]);
    const snippets = container.querySelectorAll(`.${CSS_CLS.PM_SEARCH_SNIPPET}`);
    expect(snippets).toHaveLength(1);
    expect(snippets[0].textContent).toContain("pineapple");
    const highlighted = [...snippets[0].querySelectorAll(`.${CSS_CLS.PM_SEARCH_HL}`)].map((el) => el.textContent).join("");
    expect(highlighted.toLowerCase()).toContain("pineapple");
  });

  it("highlights nothing in the name of a body-only match", async () => {
    const { container, services } = makeHarness(
      [{ path: "clients/Zephyr.md", folder: "clients", tags: ["#client"] }],
      undefined,
      { bodies: { "clients/Zephyr.md": "the team chose pineapple this quarter" } }
    );
    new PmSearchView(container, services).render();

    await type(container, "pineapple");

    expect(rowNames(container)).toEqual(["Zephyr"]);
    expect(nameHighlights(container, "Zephyr")).toEqual([]);
  });

  it("shows no snippet for a name-only match", async () => {
    const { container, services } = makeHarness(VAULT);
    new PmSearchView(container, services).render();

    await type(container, "acme");

    expect(container.querySelectorAll(`.${CSS_CLS.PM_SEARCH_SNIPPET}`).length).toBe(0);
  });

  it("drops a stale earlier result when a newer query resolves first (latest-query-wins)", async () => {
    const { container, services } = makeHarness(VAULT);
    const early = resultRow("Early");
    const late = resultRow("Late");
    let releaseEarly!: () => void;
    const earlyPending = new Promise<SearchResult[]>((resolve) => {
      releaseEarly = () => resolve([early]);
    });
    vi.spyOn(services.searchService, "search").mockImplementation((q: string) => {
      if (q === "early") return earlyPending; // resolves only when released, out of order
      if (q === "late") return Promise.resolve([late]);
      return Promise.resolve([]); // the initial empty-query paint
    });

    const view = new PmSearchView(container, services);
    view.render();
    await flush();

    // Type the earlier query (its search hangs), then a newer query that resolves now.
    await type(container, "early");
    await type(container, "late");
    expect(rowNames(container)).toEqual(["Late"]);

    // The earlier search now resolves — its result is stale and must not repaint.
    releaseEarly();
    await flush();
    expect(rowNames(container)).toEqual(["Late"]);
  });
});

/** A minimal client-typed SearchResult for the concurrency stub. */
function resultRow(name: string): SearchResult {
  return { page: createMockPage({ path: `clients/${name}.md` }), type: ENTITY_TYPE.CLIENT };
}

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

  it("ORs several values within a facet (union of both hierarchies)", async () => {
    const { container, services } = makeHarness(SCOPE_VAULT);
    const searchSpy = vi.spyOn(services.searchService, "search");
    new PmSearchView(container, services).render();

    addFacetValue(container, SEARCH_FACET_KEY.CLIENT, "Acme");
    addFacetValue(container, SEARCH_FACET_KEY.CLIENT, "Globex");
    await flush();

    expect(lastScope(searchSpy)).toEqual({ clients: ["Acme", "Globex"] });
    // Both hierarchies' descendants survive: two engagements + two projects + one
    // person + one RAID item all resolve up to Acme or Globex (the bare client
    // notes resolve to no client of their own).
    expect(rowNames(container).sort()).toEqual(
      ["Acme Eng", "Acme Proj", "Acme Risk", "Alice", "Globex Eng", "Globex Proj"].sort()
    );
  });

  it("ANDs across facets (client AND person narrows to the intersection)", async () => {
    const { container, services } = makeHarness(SCOPE_VAULT);
    new PmSearchView(container, services).render();

    addFacetValue(container, SEARCH_FACET_KEY.CLIENT, "Acme");
    addFacetValue(container, SEARCH_FACET_KEY.PERSON, "Alice");
    await flush();

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
