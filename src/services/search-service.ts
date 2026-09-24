import type { DataviewApi, EntityCandidate, EntityType, SearchResult, SearchScope } from "../types";
import type { EntityEnumerator } from "./entity-enumerator";
import type { IEntityHierarchyService, IPersonAssociationResolver, ISearchService } from "./interfaces";
import type { IFuzzyMatcher } from "./fuzzy-matcher";
import { rankCandidatesByName } from "./fuzzy-matcher";
import { FilterEngine } from "./filter-engine";
import type { FilterSpec } from "./filter-engine";
import { buildSearchFilterSpec, buildSearchFilterState } from "./search-filter";

/** Collaborators composed by {@link SearchService}, all abstractions. */
export interface SearchServiceDeps {
  /** Live Dataview API, or null when Dataview is unavailable. */
  getDv: () => DataviewApi | null;
  /** Lists a type's vault pages as candidates. */
  enumerator: EntityEnumerator;
  /** Resolves a candidate's client/engagement for scoping and the result breadcrumb. */
  hierarchyService: IEntityHierarchyService;
  /** Resolves a candidate's associated people for the person scope. */
  personResolver: IPersonAssociationResolver;
  /** Scores query-vs-name for fuzzy ranking (injected for headless testing). */
  matcher: IFuzzyMatcher;
}

/**
 * Composes the search pipeline behind the narrow {@link ISearchService}:
 * enumerate the requested types' candidates → fuzzy-rank by file name (dropping
 * non-matches, best first) → constrain by the active scope facets through the
 * pure {@link FilterEngine} → resolve each survivor's hierarchy breadcrumb into a
 * {@link SearchResult}. Ranking order is preserved through scoping and mapping.
 *
 * Depends only on abstractions and carries no `obsidian` import, so it
 * unit-tests headless with a fake matcher and stub collaborators. An empty scope
 * imposes no hierarchy constraint; an absent Dataview yields `[]` without throwing.
 */
export class SearchService implements ISearchService {
  private readonly spec: FilterSpec<EntityCandidate>;

  constructor(private readonly deps: SearchServiceDeps) {
    this.spec = buildSearchFilterSpec({
      hierarchyService: deps.hierarchyService,
      personResolver: deps.personResolver,
    });
  }

  search(query: string, scope: SearchScope, types: EntityType[]): SearchResult[] {
    if (this.deps.getDv() === null) return [];

    const candidates = types.flatMap((type) => this.deps.enumerator.candidates(type));
    const ranked = rankCandidatesByName(candidates, query, this.deps.matcher);
    const scoped = FilterEngine.apply(ranked, this.spec, buildSearchFilterState(scope));
    return scoped.map((candidate) => this.toResult(candidate));
  }

  /** Pairs a candidate with its resolved client/engagement breadcrumb (each present only when it resolves). */
  private toResult(candidate: EntityCandidate): SearchResult {
    const client = this.deps.hierarchyService.resolveClientName(candidate.page);
    const engagement = this.deps.hierarchyService.resolveEngagementName(candidate.page);
    return {
      page: candidate.page,
      type: candidate.type,
      ...(client !== null ? { client } : {}),
      ...(engagement !== null ? { engagement } : {}),
    };
  }
}
