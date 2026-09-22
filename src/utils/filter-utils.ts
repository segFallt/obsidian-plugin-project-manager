import type { AutocompleteOption, DataviewPage } from "../types";

/** Minimal capability buildEntityOptions needs: the active-entities-by-tag read. */
export interface ActiveEntitiesReader {
  getActiveEntitiesByTag(tag: string): DataviewPage[];
}

/**
 * Builds an array of AutocompleteOption values from active entities matching a given tag.
 * Used by FilterChipSelect instances in the RAID and References dashboards.
 */
export function buildEntityOptions(tag: string, queryService: ActiveEntitiesReader): AutocompleteOption[] {
  return queryService.getActiveEntitiesByTag(tag).map((p) => ({ value: p.file.name, displayText: p.file.name }));
}
