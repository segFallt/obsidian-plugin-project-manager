import { prepareFuzzySearch } from "obsidian";
import type { ITextMatcher, TextScorer } from "./matcher";

/**
 * The fuzzy {@link ITextMatcher}, wrapping Obsidian's `prepareFuzzySearch`.
 * `prepare(query)` compiles the query once via `prepareFuzzySearch`, then the
 * returned {@link TextScorer} yields each text's `score` and match offsets (or
 * `null` for a non-match) — so a search compiles its query once and reuses the
 * scorer across every candidate.
 *
 * This is the single unit that reaches for `obsidian`, so every consumer that
 * depends on {@link ITextMatcher} stays headless and unit-testable.
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
