import type { EntityCandidate } from "../types";

/**
 * A scorer bound to one query: scores how well that query matches `text`. A
 * higher score is a better match, and `null` means no match at all.
 */
export type FuzzyScorer = (text: string) => number | null;

/**
 * A fuzzy name matcher. `prepare(query)` compiles the query once and returns a
 * {@link FuzzyScorer} reused across many texts — the shape Obsidian's
 * `prepareFuzzySearch` is designed for, so search-as-you-type compiles a query
 * once per keystroke rather than once per candidate.
 *
 * The abstraction is the Dependency-Inversion seam that keeps ranking headless:
 * the ranker below depends on this interface, so it (and every consumer that
 * composes it) unit-tests with a fake matcher and never imports `obsidian`. The
 * default implementation lives in `prepared-fuzzy-matcher.ts`, the only unit
 * that reaches for Obsidian's `prepareFuzzySearch`.
 */
export interface IFuzzyMatcher {
  /** Compiles `query` into a reusable scorer over candidate texts. */
  prepare(query: string): FuzzyScorer;
}

/**
 * Ranks candidates by how well the query matches each candidate's file name.
 * The query is prepared once and the resulting scorer applied to every
 * candidate; non-matches (a `null` score) are excluded, and the survivors are
 * ordered by descending score, ties broken alphabetically by name so ordering
 * is deterministic. Pure and matcher-injected — no `obsidian` import — so it is
 * fully unit-testable with a fake matcher.
 */
export function rankCandidatesByName(
  candidates: EntityCandidate[],
  query: string,
  matcher: IFuzzyMatcher
): EntityCandidate[] {
  const scorer = matcher.prepare(query);
  const scored: Array<{ candidate: EntityCandidate; score: number }> = [];
  for (const candidate of candidates) {
    const score = scorer(candidate.page.file.name);
    if (score !== null) scored.push({ candidate, score });
  }
  scored.sort(
    (a, b) => b.score - a.score || a.candidate.page.file.name.localeCompare(b.candidate.page.file.name)
  );
  return scored.map((entry) => entry.candidate);
}
