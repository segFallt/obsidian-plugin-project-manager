import type { IQueryService } from "../services/interfaces";
import type { AutocompleteOption } from "../ui/components/filter-chip-select";

/**
 * Builds an array of AutocompleteOption values from active entities matching a given tag.
 * Used by FilterChipSelect instances in the RAID and References dashboards.
 */
export function buildEntityOptions(tag: string, queryService: IQueryService): AutocompleteOption[] {
  return queryService.getActiveEntitiesByTag(tag).map((p) => ({ value: p.file.name, displayText: p.file.name }));
}
