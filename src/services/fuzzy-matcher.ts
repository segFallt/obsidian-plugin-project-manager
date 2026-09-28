import type { EntityCandidate, SearchSnippet } from "../types";
import { MATCH_FIELD, MATCH_FIELD_ORDER, SEARCH_SNIPPET } from "../constants";
import type { MatchField } from "../constants";

/**
 * One text's match against a prepared query: a `score` (higher is a better
 * match) and the character runs `[start, end)` that matched, for highlighting.
 * `null` means the text did not match at all.
 */
export interface FuzzyMatch {
  score: number;
  matches: Array<[number, number]>;
}

/**
 * A scorer bound to one query: matches `text`, returning its {@link FuzzyMatch}
 * or `null` for a non-match.
 */
export type FuzzyScorer = (text: string) => FuzzyMatch | null;

/**
 * A fuzzy matcher. `prepare(query)` compiles the query once and returns a
 * {@link FuzzyScorer} reused across many texts — the shape Obsidian's
 * `prepareFuzzySearch` is designed for, so search-as-you-type compiles a query
 * once per keystroke rather than once per candidate.
 *
 * The abstraction is the Dependency-Inversion seam that keeps ranking headless:
 * the ranker below depends on this interface, so it (and every consumer that
 * composes it) unit-tests with a fake matcher and never imports `obsidian`. The
 * default implementation lives in `prepared-fuzzy-matcher.ts`, the only unit
 * that reaches for Obsidian's `prepareFuzzySearch`. A future strict (or
 * combination-input) match mode is a new implementation swapped at the
 * composition root, not a change here.
 */
export interface IFuzzyMatcher {
  /** Compiles `query` into a reusable scorer over candidate texts. */
  prepare(query: string): FuzzyScorer;
}

/**
 * A candidate paired with the already-resolved text of every {@link MatchField}
 * (the caller does any awaiting; the ranker stays pure and synchronous). `text`
 * carries one entry per field in {@link MATCH_FIELD_ORDER}.
 */
export interface RankInput {
  candidate: EntityCandidate;
  text: Readonly<Record<MatchField, string>>;
}

/**
 * A ranked candidate: the underlying {@link EntityCandidate} plus, for a
 * body-derived match only, the {@link SearchSnippet} explaining why it matched.
 * Structurally an `EntityCandidate`, so it flows through the scope
 * {@link import("./filter-engine").FilterEngine} unchanged.
 */
export interface RankedCandidate extends EntityCandidate {
  snippet?: SearchSnippet;
}

/** The winning field for a candidate, its score, and its match offsets in that field's text. */
interface FieldMatch {
  field: MatchField;
  score: number;
  matches: Array<[number, number]>;
}

/**
 * Ranks candidates over the ordered {@link MATCH_FIELD_ORDER} match fields
 * (today `name` at tier 0, `body` at tier 1). Each candidate wins the tier of
 * the first field whose text matches the query through the injected matcher, so
 * every name match ranks above every body-only match (strict name tiering);
 * within a tier, order is by descending score with an alphabetical tiebreak on
 * name. A body-tier winner carries a windowed {@link SearchSnippet}.
 *
 * Pure, synchronous, and matcher-injected — no `obsidian` import — so it is
 * fully unit-testable with a fake matcher. The field set and tier order are
 * named data ({@link MATCH_FIELD_ORDER}), so adding a field or reordering is an
 * Open/Closed data change, not a rewrite.
 */
export function rankCandidates(
  inputs: RankInput[],
  query: string,
  matcher: IFuzzyMatcher
): RankedCandidate[] {
  const scorer = matcher.prepare(query);
  const scored: Array<{ input: RankInput; tier: number; match: FieldMatch }> = [];
  for (const input of inputs) {
    const match = firstFieldMatch(input, scorer);
    if (match) scored.push({ input, tier: MATCH_FIELD_ORDER.indexOf(match.field), match });
  }
  scored.sort(
    (a, b) =>
      a.tier - b.tier ||
      b.match.score - a.match.score ||
      a.input.candidate.page.file.name.localeCompare(b.input.candidate.page.file.name)
  );
  return scored.map(({ input, match }) => toRanked(input, match));
}

/** The lowest-tier field whose text matches the query, or `null` if none do. */
function firstFieldMatch(input: RankInput, scorer: FuzzyScorer): FieldMatch | null {
  for (const field of MATCH_FIELD_ORDER) {
    const result = scorer(input.text[field]);
    if (result !== null) return { field, score: result.score, matches: result.matches };
  }
  return null;
}

/** Attaches a body snippet when the body field won; a name match carries no snippet. */
function toRanked(input: RankInput, match: FieldMatch): RankedCandidate {
  const ranked: RankedCandidate = { page: input.candidate.page, type: input.candidate.type };
  if (match.field !== MATCH_FIELD.BODY) return ranked;
  const snippet = buildBodySnippet(input.text[MATCH_FIELD.BODY], match.matches);
  if (snippet) ranked.snippet = snippet;
  return ranked;
}

/** A match run is a `[start, end)` tuple; these name its two positions. */
const RANGE_START = 0;
const RANGE_END = 1;
/** The window centres the match by splitting its leftover room across the two sides. */
const WINDOW_SIDES = 2;

/**
 * Builds a fixed-width excerpt centred on the body match span, with an ellipsis
 * on each clipped edge, and translates the match runs that fall inside the
 * window into snippet-relative offsets for highlighting. Returns `null` when
 * there is nothing to show (an empty query matches with no runs). Pure.
 */
export function buildBodySnippet(
  body: string,
  matches: Array<[number, number]>
): SearchSnippet | null {
  if (matches.length === 0) return null;

  const window = SEARCH_SNIPPET.WINDOW_CHARS;
  // The match span runs from the earliest run's start to the latest run's end.
  const firstStart = Math.min(...matches.map((range) => range[RANGE_START]));
  const lastEnd = Math.max(...matches.map((range) => range[RANGE_END]));
  const span = lastEnd - firstStart;
  // Centre the span in the window by splitting its leftover room across the two sides.
  const pad = Math.max(0, Math.floor((window - span) / WINDOW_SIDES));
  const end = Math.min(body.length, Math.max(firstStart - pad, 0) + window);
  const start = Math.max(0, Math.min(firstStart - pad, end - window));

  const prefix = start > 0 ? SEARCH_SNIPPET.ELLIPSIS : "";
  const suffix = end < body.length ? SEARCH_SNIPPET.ELLIPSIS : "";
  const text = prefix + body.slice(start, end) + suffix;

  const offset = prefix.length - start;
  const snippetMatches = matches
    .filter(([s, e]) => e > start && s < end)
    .map(
      ([s, e]): [number, number] => [Math.max(s, start) + offset, Math.min(e, end) + offset]
    );

  return { text, matches: snippetMatches };
}
