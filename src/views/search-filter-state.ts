import type { EntityType, SavedSearchFilters, SearchScope } from "../types";
import { ALL_ENTITY_TYPES, SCOPE_LEG, SEARCH_FACET_KEY, SEARCH_FACET_ORDER } from "../constants";

/** One of the three scope facet keys ({@link SEARCH_FACET_KEY}). */
export type SearchFacetKey = (typeof SEARCH_FACET_KEY)[keyof typeof SEARCH_FACET_KEY];

/**
 * The pm-search panel's in-memory filter state — the single source of truth the
 * scope facets, active chips, search call, and persistence all read and write.
 * The type filter is the set of enabled {@link EntityType}s (empty ⇒ every type);
 * each `*Filter` array is one facet's selected names (OR within, AND across).
 */
export interface SearchFilterState {
  typeFilter: Set<EntityType>;
  clientFilter: string[];
  engagementFilter: string[];
  personFilter: string[];
}

/**
 * Binds each scope facet to its {@link SearchFilterState} array and to the
 * {@link SearchScope} / {@link SavedSearchFilters} leg it populates. The one place
 * the facet-to-field mapping lives, so state reads, scope projection, and
 * persistence iterate the facets generically without a per-facet branch (OCP).
 */
interface FacetBinding {
  /** The scope / saved-filters leg this facet fills (`clients` / `engagements` / `people`). */
  scopeLeg: keyof SearchScope;
  get(state: SearchFilterState): string[];
  set(state: SearchFilterState, values: string[]): void;
}

export const FACET_BINDINGS: Record<SearchFacetKey, FacetBinding> = {
  [SEARCH_FACET_KEY.CLIENT]: {
    scopeLeg: SCOPE_LEG.CLIENTS,
    get: (state) => state.clientFilter,
    set: (state, values) => { state.clientFilter = values; },
  },
  [SEARCH_FACET_KEY.ENGAGEMENT]: {
    scopeLeg: SCOPE_LEG.ENGAGEMENTS,
    get: (state) => state.engagementFilter,
    set: (state, values) => { state.engagementFilter = values; },
  },
  [SEARCH_FACET_KEY.PERSON]: {
    scopeLeg: SCOPE_LEG.PEOPLE,
    get: (state) => state.personFilter,
    set: (state, values) => { state.personFilter = values; },
  },
};

const KNOWN_ENTITY_TYPES: ReadonlySet<EntityType> = new Set(ALL_ENTITY_TYPES);

/** Reads a facet's selected values off the state (the array is not copied). */
export function facetValues(state: SearchFilterState, key: SearchFacetKey): string[] {
  return FACET_BINDINGS[key].get(state);
}

/** Replaces a facet's selected values on the state. */
export function setFacetValues(state: SearchFilterState, key: SearchFacetKey, values: string[]): void {
  FACET_BINDINGS[key].set(state, values);
}

/**
 * Builds the in-memory state from persisted filters, defaulting EVERY missing
 * sub-key. Because {@link import("../settings").mergeSettings} replaces the whole
 * `savedSearchFilters` object, a sub-key absent from an older stored value (or a
 * field added in a future version) is defaulted here rather than left `undefined`.
 * Unknown persisted type strings are dropped so the type filter stays valid.
 */
export function initSearchFilterState(saved: SavedSearchFilters | null): SearchFilterState {
  const state: SearchFilterState = {
    typeFilter: new Set<EntityType>(),
    clientFilter: [],
    engagementFilter: [],
    personFilter: [],
  };
  if (!saved) return state;

  for (const key of SEARCH_FACET_ORDER) {
    const binding = FACET_BINDINGS[key];
    binding.set(state, [...(saved[binding.scopeLeg] ?? [])]);
  }
  for (const type of saved.types ?? []) {
    if (KNOWN_ENTITY_TYPES.has(type)) state.typeFilter.add(type);
  }
  return state;
}

/** Serializes the whole durable filter state for persistence. */
export function serializeSearchFilters(state: SearchFilterState): SavedSearchFilters {
  const saved: SavedSearchFilters = { types: [...state.typeFilter] };
  for (const key of SEARCH_FACET_ORDER) {
    const binding = FACET_BINDINGS[key];
    saved[binding.scopeLeg] = [...binding.get(state)];
  }
  return saved;
}

/** Projects the populated facets into a {@link SearchScope} (empty legs omitted). */
export function scopeOf(state: SearchFilterState): SearchScope {
  const scope: SearchScope = {};
  for (const key of SEARCH_FACET_ORDER) {
    const binding = FACET_BINDINGS[key];
    const values = binding.get(state);
    if (values.length > 0) scope[binding.scopeLeg] = [...values];
  }
  return scope;
}

/** The enabled types, or every type when none are enabled ("no filter = all"). */
export function activeTypesOf(state: SearchFilterState): EntityType[] {
  if (state.typeFilter.size === 0) return ALL_ENTITY_TYPES;
  return ALL_ENTITY_TYPES.filter((type) => state.typeFilter.has(type));
}

/** Whether any scope facet or type toggle is currently active. */
export function hasActiveFilter(state: SearchFilterState): boolean {
  if (state.typeFilter.size > 0) return true;
  return SEARCH_FACET_ORDER.some((key) => FACET_BINDINGS[key].get(state).length > 0);
}

/** Clears every scope facet and type toggle in place. */
export function clearFilterState(state: SearchFilterState): void {
  state.typeFilter.clear();
  for (const key of SEARCH_FACET_ORDER) FACET_BINDINGS[key].set(state, []);
}
