import type { DataviewApi, DataviewPage, EntityCandidate, EntityType, SearchResult, SearchScope } from "../types";
import { MATCH_FIELD, MATCH_FIELD_ORDER } from "../constants";
import type { MatchField } from "../constants";
import type { EntityEnumerator } from "./entity-enumerator";
import type { IEntityHierarchyService, IPersonAssociationResolver, ISearchService } from "./interfaces";
import type { IContentProvider } from "./content-provider";
import type { IFuzzyMatcher, RankedCandidate, RankInput } from "./fuzzy-matcher";
import { rankCandidates } from "./fuzzy-matcher";
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
  /** Reads a candidate's body text for content ranking (the `obsidian` read stays behind it). */
  contentProvider: IContentProvider;
  /** Scores query-vs-text for fuzzy ranking (injected for headless testing). */
  matcher: IFuzzyMatcher;
}

/** Resolves one {@link MatchField}'s text for a candidate under the active query. */
type FieldTextResolver = (candidate: EntityCandidate, query: string) => Promise<string>;

/**
 * Composes the search pipeline behind the narrow {@link ISearchService}:
 * enumerate the requested types' candidates → constrain by the active scope
 * facets through the pure {@link FilterEngine} → resolve each survivor's body
 * text through the injected {@link IContentProvider} → fuzzy-rank over name and
 * body (name matches above body-only matches, dropping non-matches) → resolve
 * each hit's hierarchy breadcrumb into a {@link SearchResult}. Scope is
 * body-independent, so it prunes candidates before the asynchronous body reads.
 *
 * Depends only on abstractions and carries no `obsidian` import, so it
 * unit-tests headless with a fake matcher and content provider. An empty scope
 * imposes no hierarchy constraint; an absent Dataview yields `[]` without
 * throwing; a single note's read failure yields empty content for that note and
 * never fails the whole search.
 */
export class SearchService implements ISearchService {
  private readonly spec: FilterSpec<EntityCandidate>;
  /**
   * One resolver per {@link MatchField}, so a new field is a data change here
   * (plus {@link MATCH_FIELD_ORDER}) rather than an edit to the ranking loop —
   * the field set stays extensible end to end (OCP). The `Record<MatchField, …>`
   * type makes a missing resolver a compile error.
   */
  private readonly fieldResolvers: Record<MatchField, FieldTextResolver>;

  constructor(private readonly deps: SearchServiceDeps) {
    this.spec = buildSearchFilterSpec({
      hierarchyService: deps.hierarchyService,
      personResolver: deps.personResolver,
    });
    this.fieldResolvers = {
      [MATCH_FIELD.NAME]: (candidate) => Promise.resolve(candidate.page.file.name),
      // An empty query wins at the name tier, so the body can never match nor
      // build a snippet — skip the (async, frontmatter-stripping) read entirely
      // on the browse/empty-query path rather than reading every note.
      [MATCH_FIELD.BODY]: (candidate, query) =>
        query.length > 0 ? this.bodyText(candidate.page) : Promise.resolve(""),
    };
  }

  async search(query: string, scope: SearchScope, types: EntityType[]): Promise<SearchResult[]> {
    if (this.deps.getDv() === null) return [];

    const candidates = types.flatMap((type) => this.deps.enumerator.candidates(type));
    // Scope is body-independent, so it prunes candidates before the async reads.
    const scoped = FilterEngine.apply(candidates, this.spec, buildSearchFilterState(scope));
    const inputs = await Promise.all(scoped.map((candidate) => this.toRankInput(candidate, query)));
    const ranked = rankCandidates(inputs, query, this.deps.matcher);
    return ranked.map((candidate) => this.toResult(candidate));
  }

  /** Resolves every match field's text for a candidate through its {@link FieldTextResolver}. */
  private async toRankInput(candidate: EntityCandidate, query: string): Promise<RankInput> {
    const entries = await Promise.all(
      MATCH_FIELD_ORDER.map(
        async (field): Promise<[MatchField, string]> => [
          field,
          await this.fieldResolvers[field](candidate, query),
        ]
      )
    );
    return { candidate, text: Object.fromEntries(entries) as Record<MatchField, string> };
  }

  /** Reads a page's body, isolating a per-note read failure as empty content (never a thrown search). */
  private async bodyText(page: DataviewPage): Promise<string> {
    try {
      return await this.deps.contentProvider.textFor(page);
    } catch {
      // A single unreadable note contributes no body match; other results still return.
      return "";
    }
  }

  /** Pairs a ranked candidate with its resolved client/engagement breadcrumb and any body snippet. */
  private toResult(candidate: RankedCandidate): SearchResult {
    const client = this.deps.hierarchyService.resolveClientName(candidate.page);
    const engagement = this.deps.hierarchyService.resolveEngagementName(candidate.page);
    return {
      page: candidate.page,
      type: candidate.type,
      ...(client !== null ? { client } : {}),
      ...(engagement !== null ? { engagement } : {}),
      ...(candidate.snippet ? { snippet: candidate.snippet } : {}),
    };
  }
}
