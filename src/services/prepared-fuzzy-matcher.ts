import { prepareFuzzySearch } from "obsidian";
import type { ITextMatcher, TextScorer } from "./matcher";

/**
 * The fuzzy {@link ITextMatcher}, wrapping Obsidian's `prepareFuzzySearch`.
 * `prepare(query)` compiles the query once via `prepareFuzzySearch`, then the
 * returned {@link TextScorer} yields each text's `score` and match offsets (or
 * `null` for a non-match) — so a search compiles its query once and reuses the
 * scorer across every candidate.
 *
 * An available fuzzy matcher that no search field binds by default; the matcher
 * each field uses is chosen at the composition root. It quarantines
 * `prepareFuzzySearch` behind {@link ITextMatcher}, so every consumer that depends
 * on that interface stays headless and unit-testable.
 */
export class PreparedFuzzyMatcher implements ITextMatcher {
  prepare(query: string): TextScorer {
    const search = prepareFuzzySearch(query);
    return (text) => {
      const result = search(text);
      return result ? { score: result.score, matches: result.matches } : null;
    };
  }
}
