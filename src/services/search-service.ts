import type { DataviewApi, DataviewPage, EntityCandidate, EntityType, SearchResult, SearchScope } from "../types";
import { MATCH_FIELD, NO_SEARCH_RESULTS } from "../constants";
import type { MatchField } from "../constants";
import { compareByFileName } from "../utils/sort-utils";
import type { EntityEnumerator } from "./entity-enumerator";
import type { IEntityHierarchyService, IPersonAssociationResolver, ISearchService } from "./interfaces";
import type { IContentProvider } from "./content-provider";
import type { SearchField, RankedCandidate, RankInput } from "./matcher";
import { rankCandidates } from "./matcher";
import { FilterEngine } from "./filter-engine";
import type { FilterSpec } from "./filter-engine";
import { buildSearchFilterSpec, buildSearchFilterState } from "./search-filter";
import { isBrowseQuery, normalizeQuery } from "./search-query";

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
  /**
   * The ordered match-field descriptor list (tier order = array order): each field
   * paired with its own matcher and snippet policy. Injected so the concrete
   * matcher per field is chosen at the composition root and this service stays
   * headless and testable with fakes.
   */
  fields: readonly SearchField[];
}

/** Resolves one {@link MatchField}'s text for a candidate. */
type FieldTextResolver = (candidate: EntityCandidate) => Promise<string>;

/**
 * Composes the search pipeline behind the narrow {@link ISearchService}:
 * normalize the query (trim outer whitespace) → enumerate the requested types'
 * candidates → constrain by the active scope facets through the pure
 * {@link FilterEngine} → then either browse or rank:
 *
 * - Browse (an empty or whitespace-only query): every scoped candidate, sorted by
 *   name, with no body reads, no `match`, and no snippet.
 * - Rank (any other query): resolve each survivor's name and body text (the body
 *   through the injected {@link IContentProvider}), then rank over the injected
 *   match fields (name matches above body-only matches, dropping non-matches).
 *
 * Finally each result's hierarchy breadcrumb is resolved into a
 * {@link SearchResult}. Scope is body-independent, so it prunes candidates before
 * the asynchronous body reads.
 *
 * Depends only on abstractions and carries no `obsidian` import, so it
 * unit-tests headless with a fake matcher and content provider. An empty scope
 * imposes no hierarchy constraint; an absent Dataview yields
 * {@link NO_SEARCH_RESULTS} without throwing; a single note's read failure yields
 * empty content for that note and never fails the whole search.
 */
export class SearchService implements ISearchService {
  private readonly spec: FilterSpec<EntityCandidate>;
  /**
   * One resolver per {@link MatchField}, so a new field is a data change here
   * (plus the injected {@link SearchField} list) rather than an edit to the
   * ranking loop — the field set stays extensible end to end (OCP). The
   * `Record<MatchField, …>` type makes a missing resolver a compile error.
   */
  private readonly fieldResolvers: Record<MatchField, FieldTextResolver>;

  constructor(private readonly deps: SearchServiceDeps) {
    this.spec = buildSearchFilterSpec({
      hierarchyService: deps.hierarchyService,
      personResolver: deps.personResolver,
    });
    this.fieldResolvers = {
      [MATCH_FIELD.NAME]: (candidate) => Promise.resolve(candidate.page.file.name),
      [MATCH_FIELD.BODY]: (candidate) => this.bodyText(candidate.page),
    };
  }

  async search(
    query: string,
    scope: SearchScope,
    types: EntityType[]
  ): Promise<readonly SearchResult[]> {
    if (this.deps.getDv() === null) return NO_SEARCH_RESULTS;

    const normalized = normalizeQuery(query);
    const candidates = types.flatMap((type) => this.deps.enumerator.candidates(type));
    // Scope is body-independent, so it prunes candidates before the async reads.
    const scoped = FilterEngine.apply(candidates, this.spec, buildSearchFilterState(scope));
    const found: readonly RankedCandidate[] = isBrowseQuery(normalized)
      ? this.browse(scoped)
      : await this.rank(scoped, normalized);
    return found.map((candidate) => this.toResult(candidate));
  }

  /**
   * The browse step: every scoped candidate sorted by name, with no text
   * resolution and no matching. Sorts a copy, so the scoped list is never mutated.
   */
  private browse(scoped: readonly EntityCandidate[]): EntityCandidate[] {
    return [...scoped].sort((a, b) => compareByFileName(a.page, b.page));
  }

  /** The rank step: resolves each candidate's field texts, then ranks them against `query`. */
  private async rank(scoped: readonly EntityCandidate[], query: string): Promise<RankedCandidate[]> {
    const inputs = await Promise.all(scoped.map((candidate) => this.toRankInput(candidate)));
    return rankCandidates(inputs, query, this.deps.fields);
  }

  /** Resolves every match field's text for a candidate through its {@link FieldTextResolver}. */
  private async toRankInput(candidate: EntityCandidate): Promise<RankInput> {
    const entries = await Promise.all(
      this.deps.fields.map(
        async (f): Promise<[MatchField, string]> => [f.field, await this.fieldResolvers[f.field](candidate)]
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

  /**
   * Pairs a browsed or ranked candidate with its resolved client/engagement
   * breadcrumb, and passes through its `match` and body snippet when present.
   */
  private toResult(candidate: RankedCandidate): SearchResult {
    const result: SearchResult = { page: candidate.page, type: candidate.type };
    const client = this.deps.hierarchyService.resolveClientName(candidate.page);
    if (client !== null) result.client = client;
    const engagement = this.deps.hierarchyService.resolveEngagementName(candidate.page);
    if (engagement !== null) result.engagement = engagement;
    if (candidate.snippet) result.snippet = candidate.snippet;
    if (candidate.match) result.match = candidate.match;
    return result;
  }
}
