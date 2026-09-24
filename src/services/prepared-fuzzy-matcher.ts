import { prepareFuzzySearch } from "obsidian";
import type { FuzzyScorer, IFuzzyMatcher } from "./fuzzy-matcher";

/**
 * The production {@link IFuzzyMatcher}, wrapping Obsidian's `prepareFuzzySearch`.
 * `prepare(query)` compiles the query once via `prepareFuzzySearch`, then the
 * returned {@link FuzzyScorer} yields each text's `score` (or `null` for a
 * non-match) — so a search compiles its query once and reuses the scorer across
 * every candidate.
 *
 * This is the single unit that reaches for `obsidian`, so every consumer that
 * depends on {@link IFuzzyMatcher} stays headless and unit-testable.
 */
export class PreparedFuzzyMatcher implements IFuzzyMatcher {
  prepare(query: string): FuzzyScorer {
    const search = prepareFuzzySearch(query);
    return (text) => {
      const result = search(text);
      return result ? result.score : null;
    };
  }
}
