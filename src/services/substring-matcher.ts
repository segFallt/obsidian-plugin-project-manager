import type { ITextMatcher, TextScorer } from "./matcher";

/** Characters with special meaning in a `RegExp`, escaped so a query matches literally. */
const REGEXP_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g;
/** Replacement that prefixes each matched special character with a backslash. */
const REGEXP_ESCAPE = "\\$&";
/** `RegExp` flag for case-insensitive matching. */
const CASE_INSENSITIVE_FLAG = "i";
/** A match at the start of the text scores highest; this is that top score. */
const TOP_SCORE = 0;

/** Escapes a query so every character matches literally inside a `RegExp`. */
function escapeForRegExp(query: string): string {
  return query.replace(REGEXP_SPECIAL_CHARS, REGEXP_ESCAPE);
}

/**
 * A strict {@link ITextMatcher}: the query must occur verbatim (case-insensitive)
 * as a substring of the text. `prepare(query)` compiles the query once into a
 * {@link TextScorer} that finds the earliest occurrence in the text and reports
 * it as a single match run.
 *
 * - A non-occurrence returns `null`, and so does an empty query — an empty query
 *   is a non-match here, leaving the empty/browse path to the name tier rather
 *   than surfacing every note on its body.
 * - On a hit the scorer returns one run `[[start, end)]` for the first occurrence
 *   (a single run, not one per character), the exact offset shape the body-snippet
 *   builder consumes. `end` is derived from the matched text's own length, so the
 *   run frames the real occurrence in the original text even when case folding
 *   changes a character's length.
 * - `score` is the negated first-occurrence index (`-start`), so an occurrence at
 *   index 0 scores highest and an earlier occurrence outranks a later one.
 *
 * Matching is done with a case-insensitive `RegExp` over the original text, so the
 * reported offsets always index that text directly. Headless — no `obsidian`
 * import — so it composes into the ranker for unit tests.
 */
export class SubstringMatcher implements ITextMatcher {
  prepare(query: string): TextScorer {
    if (query.length === 0) return () => null;
    const pattern = new RegExp(escapeForRegExp(query), CASE_INSENSITIVE_FLAG);
    return (text) => {
      const match = pattern.exec(text);
      if (match === null) return null;
      const start = match.index;
      // `match[0]` is the matched text in its original casing, so its length frames
      // the real occurrence in `text` regardless of any case-fold length change.
      const end = start + match[0].length;
      // Index 0 normalizes to +0 (not -0) so the top score compares cleanly.
      const score = start === 0 ? TOP_SCORE : -start;
      return { score, matches: [[start, end]] };
    };
  }
}
