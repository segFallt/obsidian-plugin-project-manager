import type { DataviewPage, ReferenceFilters } from "../types";
import { REF_FACET_KEY, FM_KEY } from "../constants";
import { normalizeToName } from "../utils/link-utils";
import type { IEntityHierarchyService } from "./interfaces";
import { createFilterSpec } from "./filter-engine";
import type { Facet, FilterSpec, FilterState } from "./filter-engine";

/**
 * ─── Reference FilterSpec ────────────────────────────────────────────────────
 *
 * The References half of the dashboard filter capability: a facet catalog
 * matching the pure {@link FilterEngine}. Each facet matches a single reference
 * against its selected value, preserving the reference dashboard's filter
 * semantics — topic intersection (normalized both sides), resolved-client
 * membership, engagement-name membership, and case-insensitive file-name search.
 *
 * The only external dependency — client/engagement resolution — is captured in
 * the predicate closures via {@link ReferenceFacetDeps}, so the engine itself
 * stays dependency-free. `selectedNode` (the active sidebar node) and `viewMode`
 * are NOT facets: the former is renderer scoping state, the latter selects the
 * renderer.
 */

/** Dependencies the reference facet predicates capture. */
export interface ReferenceFacetDeps {
  hierarchyService: IEntityHierarchyService;
}

/** Reads a reference's `topics` frontmatter as an array (non-array ⇒ empty). */
function referenceTopics(item: DataviewPage): unknown[] {
  const topics = item[FM_KEY.TOPICS];
  return Array.isArray(topics) ? (topics as unknown[]) : [];
}

/** Whether any of the reference's topics intersects the selected topic names. */
function topicsMatch(item: DataviewPage, names: string[]): boolean {
  const topics = referenceTopics(item);
  return names.some((ft) => topics.some((t) => normalizeToName(t) === normalizeToName(ft)));
}

/** Whether a reference's resolved client is one of the selected names. */
function clientMatches(item: DataviewPage, names: string[], deps: ReferenceFacetDeps): boolean {
  const client = deps.hierarchyService.resolveClientName(item) ?? "";
  return names.includes(client);
}

/** Whether a reference's engagement name is one of the selected names. */
function engagementMatches(item: DataviewPage, names: string[]): boolean {
  const engagement = normalizeToName(item[FM_KEY.ENGAGEMENT]) ?? "";
  return names.includes(engagement);
}

/** Full reference facet catalog. Resolution deps are captured in the predicate closures. */
export function buildReferenceFacets(deps: ReferenceFacetDeps): Facet<DataviewPage>[] {
  return [
    { key: REF_FACET_KEY.TOPICS, predicate: (item, names) => topicsMatch(item, names as string[]) },
    { key: REF_FACET_KEY.CLIENTS, predicate: (item, names) => clientMatches(item, names as string[], deps) },
    { key: REF_FACET_KEY.ENGAGEMENTS, predicate: (item, names) => engagementMatches(item, names as string[]) },
    {
      key: REF_FACET_KEY.SEARCH_TEXT,
      predicate: (item, text) => item.file.name.toLowerCase().includes(String(text).toLowerCase()),
    },
  ];
}

/** Full reference FilterSpec (facet catalog + specWithout). */
export function buildReferenceFilterSpec(deps: ReferenceFacetDeps): FilterSpec<DataviewPage> {
  return createFilterSpec(buildReferenceFacets(deps));
}

/**
 * Derives the dynamic `FilterState` from a `ReferenceFilters` object. A facet key
 * is added to `selections` only when its filter is *active*, so the engine's
 * "no selection ⇒ skip" rule reproduces the original guards (an empty topic /
 * client / engagement list means "no constraint", not "match nothing").
 */
export function buildReferenceFilterState(f: ReferenceFilters): FilterState {
  const selections: Record<string, unknown> = {};

  if (f.topics.length > 0) selections[REF_FACET_KEY.TOPICS] = f.topics;
  if (f.clients.length > 0) selections[REF_FACET_KEY.CLIENTS] = f.clients;
  if (f.engagements.length > 0) selections[REF_FACET_KEY.ENGAGEMENTS] = f.engagements;
  if (f.searchText) selections[REF_FACET_KEY.SEARCH_TEXT] = f.searchText;

  return { selections, viewMode: f.viewMode };
}
