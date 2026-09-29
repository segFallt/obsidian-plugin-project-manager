import type { EntityCandidate, MatchRun, SearchMatch, SearchSnippet } from "../types";
import { EMPTY_LENGTH, SEARCH_SNIPPET, TEXT_START, TIER } from "../constants";
import type { MatchField } from "../constants";
import { compareByFileName } from "../utils/sort-utils";

/**
 * One text's match against a prepared query: a `score` (higher is a better
 * match) and the character runs `[start, end)` that matched, for highlighting —
 * ascending and non-overlapping, per the `MatchRun` contract. `null` means the
 * text did not match at all.
 */
export interface TextMatch {
  score: number;
  matches: readonly MatchRun[];
}

/**
 * A scorer bound to one query: matches `text`, returning its {@link TextMatch}
 * or `null` for a non-match.
 */
export type TextScorer = (text: string) => TextMatch | null;

/**
 * A text matcher of any match mode. `prepare(query)` compiles the query once and
 * returns a {@link TextScorer} reused across many texts — the shape Obsidian's
 * `prepareFuzzySearch` is designed for, so search-as-you-type compiles a query
 * once per keystroke rather than once per candidate. Each match field binds its
 * own matcher, so fields can use different match modes.
 *
 * The abstraction is the Dependency-Inversion seam that keeps ranking headless:
 * the ranker below depends on this interface, so it (and every consumer that
 * composes it) unit-tests with a fake matcher and never imports `obsidian`. The
 * fuzzy implementation lives in `prepared-fuzzy-matcher.ts` (the only unit that
 * reaches for Obsidian's `prepareFuzzySearch`); the strict substring
 * implementation lives in `substring-matcher.ts`. Which matcher a field uses is
 * chosen at the composition root, not here.
 */
export interface ITextMatcher {
  /** Compiles `query` into a reusable scorer over candidate texts. */
  prepare(query: string): TextScorer;
}

/**
 * A field's search policy, and the single home for it: which fields exist, the
 * tier order (the array order of the descriptor list — a lower index ranks
 * higher), the matcher each field is scored with, and whether a win on the field
 * yields a highlighted snippet. The ordered `SearchField[]` is assembled at the
 * composition root, so choosing the matcher each field binds — or adding,
 * reordering, or re-mattering a field — is a data change there rather than an
 * edit to the ranker.
 */
export interface SearchField {
  field: MatchField;
  matcher: ITextMatcher;
  buildsSnippet: boolean;
}

/**
 * A candidate paired with the already-resolved text of every match field (the
 * caller does any awaiting; the ranker stays pure and synchronous). `text`
 * carries one entry per field in the {@link SearchField} descriptor list.
 */
export interface RankInput {
  candidate: EntityCandidate;
  text: Readonly<Record<MatchField, string>>;
}

/**
 * A ranked candidate: the underlying {@link EntityCandidate} plus its
 * {@link SearchMatch} (the winning field and the query's runs in that field's
 * text) and, for a body-derived match only, the {@link SearchSnippet} explaining
 * why it matched.
 */
export interface RankedCandidate extends EntityCandidate {
  snippet?: SearchSnippet;
  match?: SearchMatch;
}

/**
 * The winning field for a candidate: the {@link SearchMatch} evidence (the field
 * and its match runs in that field's text), its score, and whether the field's
 * descriptor asks for a snippet — carried here so the winning field's policy
 * travels with the match rather than being looked up again downstream.
 */
type FieldMatch = SearchMatch & { score: number; buildsSnippet: boolean };

/** A winning field's match paired with that field's tier (its index in the descriptor list). */
interface TieredMatch {
  tier: number;
  match: FieldMatch;
}

/** An input paired with its winning field and that field's tier. */
interface MatchedInput {
  input: RankInput;
  found: TieredMatch;
}

/** A field descriptor paired with its prepared, query-bound scorer. */
interface PreparedField {
  descriptor: SearchField;
  scorer: TextScorer;
}

/**
 * Ranks candidates over the ordered {@link SearchField} descriptor list (for
 * example name at the first tier and body at the next, as wired at the
 * composition root). Each candidate wins the tier of the first
 * field whose text matches the query through that field's own matcher, so every
 * name match ranks above every body-only match (strict name tiering); within a
 * tier, order is by descending score, with ties broken alphabetically by page
 * name through {@link compareByFileName}. Every ranked candidate carries `match`,
 * set from the winning field (its field and every match run the matcher
 * reported); a field whose descriptor sets `buildsSnippet` also carries a
 * windowed {@link SearchSnippet} when it wins.
 *
 * Pure, synchronous, and matcher-injected — no `obsidian` import — so it is
 * fully unit-testable with fake matchers. Each field prepares its own scorer
 * once, then reuses it across every candidate. The field set, tier order, and
 * per-field matcher are named data (the `fields` list), so adding a field,
 * reordering, or swapping a matcher is an Open/Closed data change, not a rewrite.
 */
export function rankCandidates(
  inputs: RankInput[],
  query: string,
  fields: readonly SearchField[]
): RankedCandidate[] {
  const prepared: PreparedField[] = fields.map((descriptor) => ({
    descriptor,
    scorer: descriptor.matcher.prepare(query),
  }));
  return inputs
    .map((input) => ({ input, found: firstFieldMatch(input, prepared) }))
    .filter((entry): entry is MatchedInput => entry.found !== null)
    .sort(
      (a, b) =>
        a.found.tier - b.found.tier ||
        b.found.match.score - a.found.match.score ||
        compareByFileName(a.input.candidate.page, b.input.candidate.page)
    )
    .map(({ input, found }) => toRanked(input, found.match));
}

/**
 * The lowest-tier field whose text matches the query (using that field's own
 * prepared scorer), with the field's index as its tier, or `null` if none match.
 */
function firstFieldMatch(
  input: RankInput,
  prepared: readonly PreparedField[]
): TieredMatch | null {
  for (let tier = TIER.FIRST; tier < prepared.length; tier += TIER.STEP) {
    const { descriptor, scorer } = prepared[tier];
    const result = scorer(input.text[descriptor.field]);
    if (result !== null) {
      return {
        tier,
        match: {
          field: descriptor.field,
          score: result.score,
          matches: result.matches,
          buildsSnippet: descriptor.buildsSnippet,
        },
      };
    }
  }
  return null;
}

/**
 * Builds the ranked candidate for a winning field: always sets `match` to that
 * field's evidence (its field and match runs, never its score or snippet policy),
 * and also attaches a snippet when the field's descriptor sets `buildsSnippet`.
 */
function toRanked(input: RankInput, match: FieldMatch): RankedCandidate {
  const ranked: RankedCandidate = { page: input.candidate.page, type: input.candidate.type };
  ranked.match = { field: match.field, matches: match.matches };
  if (!match.buildsSnippet) return ranked;
  const snippet = buildBodySnippet(input.text[match.field], match.matches);
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
 * there is nothing to show (no match runs). Pure.
 */
export function buildBodySnippet(
  body: string,
  matches: readonly MatchRun[]
): SearchSnippet | null {
  if (matches.length === EMPTY_LENGTH) return null;

  const window = SEARCH_SNIPPET.WINDOW_CHARS;
  // The match span runs from the earliest run's start to the latest run's end.
  const firstStart = Math.min(...matches.map((range) => range[RANGE_START]));
  const lastEnd = Math.max(...matches.map((range) => range[RANGE_END]));
  const span = lastEnd - firstStart;
  // Centre the span in the window by splitting its leftover room across the two sides.
  const pad = Math.max(EMPTY_LENGTH, Math.floor((window - span) / WINDOW_SIDES));
  const end = Math.min(body.length, Math.max(firstStart - pad, TEXT_START) + window);
  const start = Math.max(TEXT_START, Math.min(firstStart - pad, end - window));

  const prefix = start > TEXT_START ? SEARCH_SNIPPET.ELLIPSIS : SEARCH_SNIPPET.NO_ELLIPSIS;
  const suffix = end < body.length ? SEARCH_SNIPPET.ELLIPSIS : SEARCH_SNIPPET.NO_ELLIPSIS;
  const text = prefix + body.slice(start, end) + suffix;

  const offset = prefix.length - start;
  const snippetMatches = matches
    .filter(([s, e]) => e > start && s < end)
    .map(([s, e]): MatchRun => [Math.max(s, start) + offset, Math.min(e, end) + offset]);

  return { text, matches: snippetMatches };
}
