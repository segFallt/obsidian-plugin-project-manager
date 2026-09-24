import { describe, it, expect } from "vitest";
import {
  activeTypesOf,
  clearFilterState,
  hasActiveFilter,
  initSearchFilterState,
  scopeOf,
  serializeSearchFilters,
} from "@/views/search-filter-state";
import { SettingsViewStore } from "@/processors/view-state-store";
import { ALL_ENTITY_TYPES, ENTITY_TYPE, SAVED_SEARCH_FILTERS_STATE_KEY } from "@/constants";
import type { SavedSearchFilters } from "@/types";

describe("search-filter-state — initSearchFilterState defaulting", () => {
  it("defaults every sub-key from a null saved value without throwing", () => {
    const state = initSearchFilterState(null);
    expect(state.clientFilter).toEqual([]);
    expect(state.engagementFilter).toEqual([]);
    expect(state.personFilter).toEqual([]);
    expect(state.typeFilter.size).toBe(0);
  });

  it("restores populated facets and type toggles", () => {
    const state = initSearchFilterState({
      clients: ["Acme"],
      engagements: ["Acme Eng"],
      people: ["Alice"],
      types: [ENTITY_TYPE.CLIENT, ENTITY_TYPE.PERSON],
    });
    expect(state.clientFilter).toEqual(["Acme"]);
    expect(state.engagementFilter).toEqual(["Acme Eng"]);
    expect(state.personFilter).toEqual(["Alice"]);
    expect([...state.typeFilter]).toEqual([ENTITY_TYPE.CLIENT, ENTITY_TYPE.PERSON]);
  });

  it("drops unknown persisted type strings so the filter stays valid", () => {
    const state = initSearchFilterState({ types: ["client", "not-a-type"] as never });
    expect([...state.typeFilter]).toEqual([ENTITY_TYPE.CLIENT]);
  });

  // The deep-merge gotcha: mergeSettings replaces the whole savedSearchFilters
  // object, so an older stored value (or a future-added field) can be missing a
  // sub-key. Reading must default it rather than leaving it undefined.
  it("defaults a missing sub-key from a partially-stored value without throwing", () => {
    const partial = { clients: ["Acme"] } as SavedSearchFilters; // engagements/people/types absent
    const state = initSearchFilterState(partial);
    expect(state.clientFilter).toEqual(["Acme"]);
    expect(state.engagementFilter).toEqual([]);
    expect(state.personFilter).toEqual([]);
    expect(state.typeFilter.size).toBe(0);
  });

  it("defaults missing sub-keys when restored through a SettingsViewStore", () => {
    const ui: Record<string, unknown> = { [SAVED_SEARCH_FILTERS_STATE_KEY]: { clients: ["Acme"] } };
    const store = new SettingsViewStore(
      () => ui,
      () => Promise.resolve()
    );
    const saved = store.load(SAVED_SEARCH_FILTERS_STATE_KEY) as SavedSearchFilters | null;
    expect(() => initSearchFilterState(saved)).not.toThrow();
    const state = initSearchFilterState(saved);
    expect(state.clientFilter).toEqual(["Acme"]);
    expect(state.engagementFilter).toEqual([]);
    expect(state.personFilter).toEqual([]);
  });
});

describe("search-filter-state — serialize / scope / types", () => {
  it("round-trips the whole filter state through serialize → init", () => {
    const original = initSearchFilterState({
      clients: ["Acme", "Globex"],
      people: ["Alice"],
      types: [ENTITY_TYPE.CLIENT],
    });
    const restored = initSearchFilterState(serializeSearchFilters(original));
    expect(restored.clientFilter).toEqual(["Acme", "Globex"]);
    expect(restored.engagementFilter).toEqual([]);
    expect(restored.personFilter).toEqual(["Alice"]);
    expect([...restored.typeFilter]).toEqual([ENTITY_TYPE.CLIENT]);
  });

  it("projects only populated facets into the scope (OR within, empty legs omitted)", () => {
    const state = initSearchFilterState({ clients: ["Acme", "Globex"], people: ["Alice"] });
    expect(scopeOf(state)).toEqual({ clients: ["Acme", "Globex"], people: ["Alice"] });
  });

  it("returns every type when no toggle is set and exactly the enabled types otherwise", () => {
    expect(activeTypesOf(initSearchFilterState(null))).toEqual(ALL_ENTITY_TYPES);
    const scoped = initSearchFilterState({ types: [ENTITY_TYPE.PERSON, ENTITY_TYPE.CLIENT] });
    // Preserves ALL_ENTITY_TYPES order, not selection order.
    expect(activeTypesOf(scoped)).toEqual([ENTITY_TYPE.CLIENT, ENTITY_TYPE.PERSON]);
  });

  it("reports and clears active filters", () => {
    const state = initSearchFilterState({ clients: ["Acme"], types: [ENTITY_TYPE.CLIENT] });
    expect(hasActiveFilter(state)).toBe(true);
    clearFilterState(state);
    expect(hasActiveFilter(state)).toBe(false);
    expect(scopeOf(state)).toEqual({});
    expect(activeTypesOf(state)).toEqual(ALL_ENTITY_TYPES);
  });
});
