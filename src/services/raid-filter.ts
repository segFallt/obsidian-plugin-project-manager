import type { DataviewPage, RaidDashboardFilters, RaidLikelihood, RaidImpact } from "../types";
import { RAID_FACET_KEY, RAID_VIEW_MODE, FM_KEY } from "../constants";
import type { IEntityHierarchyService } from "./interfaces";
import { createFilterSpec } from "./filter-engine";
import type { Facet, FilterSpec, FilterState } from "./filter-engine";

/**
 * ─── RAID FilterSpec ────────────────────────────────────────────────────────
 *
 * The RAID half of the dashboard filter capability: a facet catalog matching
 * the pure {@link FilterEngine}. Each facet matches a single item against its
 * selected value; the only external dependency — client/engagement resolution —
 * is captured in the predicate closures via {@link RaidFacetDeps}, so the engine
 * itself stays dependency-free. Status/client/engagement narrowing lives here
 * (not in the query), per the Bridge design.
 */

/** The resolved matrix cell an item is compared against. */
type MatrixCell = { likelihood: RaidLikelihood; impact: RaidImpact };

/** Dependencies the RAID facet predicates capture. */
export interface RaidFacetDeps {
  hierarchyService: IEntityHierarchyService;
}

/** Whether an item's resolved client is one of the selected names. */
function clientMatches(item: DataviewPage, names: string[], deps: RaidFacetDeps): boolean {
  const client = deps.hierarchyService.resolveClientName(item) ?? "";
  return names.some((name) => client === name);
}

/** Whether an item's resolved engagement is one of the selected names. */
function engagementMatches(item: DataviewPage, names: string[], deps: RaidFacetDeps): boolean {
  const engagement = deps.hierarchyService.resolveEngagementName(item) ?? "";
  return names.some((name) => engagement === name);
}

/** Whether an item sits in the selected likelihood×impact cell. */
function matrixCellMatches(item: DataviewPage, cell: MatrixCell): boolean {
  return (
    String(item[FM_KEY.LIKELIHOOD] ?? "") === cell.likelihood &&
    String(item[FM_KEY.IMPACT] ?? "") === cell.impact
  );
}

/** Full RAID facet catalog. Resolution deps are captured in the predicate closures. */
export function buildRaidFacets(deps: RaidFacetDeps): Facet<DataviewPage>[] {
  return [
    { key: RAID_FACET_KEY.RAID_TYPES, accessor: (item) => String(item[FM_KEY.RAID_TYPE] ?? "") },
    { key: RAID_FACET_KEY.STATUS, accessor: (item) => String(item[FM_KEY.STATUS] ?? "") },
    { key: RAID_FACET_KEY.CLIENT, predicate: (item, names) => clientMatches(item, names as string[], deps) },
    { key: RAID_FACET_KEY.ENGAGEMENT, predicate: (item, names) => engagementMatches(item, names as string[], deps) },
    {
      key: RAID_FACET_KEY.SEARCH_TEXT,
      predicate: (item, text) => item.file.name.toLowerCase().includes(String(text).toLowerCase()),
    },
    { key: RAID_FACET_KEY.MATRIX_CELL, predicate: (item, cell) => matrixCellMatches(item, cell as MatrixCell) },
  ];
}

/** Full RAID FilterSpec (facet catalog + specWithout). */
export function buildRaidFilterSpec(deps: RaidFacetDeps): FilterSpec<DataviewPage> {
  return createFilterSpec(buildRaidFacets(deps));
}

/**
 * Derives the dynamic `FilterState` from a `RaidDashboardFilters` object. A facet
 * key is added to `selections` only when its filter is *active*, so the engine's
 * "no selection ⇒ skip" rule reproduces the original guards (an empty type or
 * status list means "no constraint", not "match nothing").
 */
export function buildRaidFilterState(f: RaidDashboardFilters): FilterState {
  const selections: Record<string, unknown> = {};

  if (f.raidTypes.length > 0) selections[RAID_FACET_KEY.RAID_TYPES] = f.raidTypes;
  if (f.statusFilter.length > 0) selections[RAID_FACET_KEY.STATUS] = f.statusFilter;
  if (f.clientFilter.length > 0) selections[RAID_FACET_KEY.CLIENT] = f.clientFilter;
  if (f.engagementFilter.length > 0) selections[RAID_FACET_KEY.ENGAGEMENT] = f.engagementFilter;
  if (f.searchText) selections[RAID_FACET_KEY.SEARCH_TEXT] = f.searchText;
  if (f.matrixCell) selections[RAID_FACET_KEY.MATRIX_CELL] = f.matrixCell;

  return { selections, viewMode: RAID_VIEW_MODE.MATRIX };
}
