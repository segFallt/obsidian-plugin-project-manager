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
} from "@/constants";
import type { EntityType } from "@/types";
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

function makeHarness(pages: MockPageData[], getDv?: () => DataviewApi | null): Harness {
  const dv = createMockDataviewApi(pages);
  const resolvedGetDv = getDv ?? ((): DataviewApi | null => dv);
  const query = new QueryService(resolvedGetDv, folders);
  const searchService = new SearchService({
    getDv: resolvedGetDv,
    enumerator: new EntityEnumerator(query),
    hierarchyService: new EntityHierarchyService(resolvedGetDv, folders),
    personResolver: new PersonAssociationResolver(resolvedGetDv, folders),
    matcher: new PreparedFuzzyMatcher(),
  });

  const openFile = vi.fn().mockResolvedValue(undefined);
  const services: SearchViewServices = {
    app: { vault: { getAbstractFileByPath: (path: string) => new TFile(path) } } as unknown as SearchViewServices["app"],
    searchService,
    navigationService: { openFile },
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

  it("opens and closes the filter drawer from the filter button", () => {
    const { container, services } = makeHarness(VAULT);
    const view = new PmSearchView(container, services);
    view.render();

    const button = container.querySelector<HTMLButtonElement>(`.${CSS_CLS.PM_SEARCH_FILTER_BTN}`)!;
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
