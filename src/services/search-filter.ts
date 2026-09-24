import type { EntityCandidate, SearchScope } from "../types";
import { SEARCH_FACET_KEY, SEARCH_VIEW_MODE } from "../constants";
import type { IEntityHierarchyService, IPersonAssociationResolver } from "./interfaces";
import { createFilterSpec } from "./filter-engine";
import type { Facet, FilterSpec, FilterState } from "./filter-engine";

/**
 * ─── Search scope FilterSpec ────────────────────────────────────────────────
 *
 * The scope half of entity search: a facet catalog over {@link EntityCandidate}s
 * matching the pure {@link FilterEngine}. Each facet keeps a candidate when it
 * satisfies one of the selected names (OR within a facet); the engine ANDs the
 * active facets together. Resolution collaborators are captured in the predicate
 * closures via {@link SearchFacetDeps}, so the engine itself stays dependency-free.
 */

/** Collaborators the scope facet predicates capture. */
export interface SearchFacetDeps {
  hierarchyService: IEntityHierarchyService;
  personResolver: IPersonAssociationResolver;
}

/** Whether a candidate resolves up to one of the selected client names. */
function clientMatches(item: EntityCandidate, names: string[], deps: SearchFacetDeps): boolean {
  const client = deps.hierarchyService.resolveClientName(item.page);
  return client !== null && names.includes(client);
}

/** Whether a candidate resolves up to one of the selected engagement names. */
function engagementMatches(item: EntityCandidate, names: string[], deps: SearchFacetDeps): boolean {
  const engagement = deps.hierarchyService.resolveEngagementName(item.page);
  return engagement !== null && names.includes(engagement);
}

/** Whether one of the selected people is associated with the candidate. */
function personMatches(item: EntityCandidate, names: string[], deps: SearchFacetDeps): boolean {
  const people = deps.personResolver.peopleOf(item.page);
  return names.some((name) => people.includes(name));
}

/**
 * One scope dimension in a single place: its facet key, how its selected names
 * are read from a {@link SearchScope}, and how a candidate matches them. The
 * facet catalog and the `FilterState` both derive from this table, so adding a
 * scope dimension is one entry here and nothing else (OCP).
 */
interface ScopeDimension {
  key: string;
  select: (scope: SearchScope) => string[] | undefined;
  matches: (item: EntityCandidate, names: string[], deps: SearchFacetDeps) => boolean;
}

const SCOPE_DIMENSIONS: readonly ScopeDimension[] = [
  { key: SEARCH_FACET_KEY.CLIENT, select: (scope) => scope.clients, matches: clientMatches },
  { key: SEARCH_FACET_KEY.ENGAGEMENT, select: (scope) => scope.engagements, matches: engagementMatches },
  { key: SEARCH_FACET_KEY.PERSON, select: (scope) => scope.people, matches: personMatches },
];

/** Full scope facet catalog. Resolution collaborators are captured in the predicate closures. */
export function buildSearchFacets(deps: SearchFacetDeps): Facet<EntityCandidate>[] {
  return SCOPE_DIMENSIONS.map((dimension) => ({
    key: dimension.key,
    predicate: (item, names) => dimension.matches(item, names as string[], deps),
  }));
}

/** Full scope FilterSpec (facet catalog + specWithout). */
export function buildSearchFilterSpec(deps: SearchFacetDeps): FilterSpec<EntityCandidate> {
  return createFilterSpec(buildSearchFacets(deps));
}

/**
 * Derives the dynamic `FilterState` from a {@link SearchScope}. A facet key is
 * added to `selections` only when its leg carries names, so the engine's "no
 * selection ⇒ skip" rule leaves an empty leg unconstrained.
 */
export function buildSearchFilterState(scope: SearchScope): FilterState {
  const selections: Record<string, unknown> = {};

  for (const dimension of SCOPE_DIMENSIONS) {
    const names = dimension.select(scope);
    if (names && names.length > 0) selections[dimension.key] = names;
  }

  return { selections, viewMode: SEARCH_VIEW_MODE.DEFAULT };
}
