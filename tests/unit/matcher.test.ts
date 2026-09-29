import { describe, it, expect } from "vitest";
import {
  rankCandidates,
  buildBodySnippet,
  type ITextMatcher,
  type RankInput,
  type SearchField,
} from "@/services/matcher";
import { PreparedFuzzyMatcher } from "@/services/prepared-fuzzy-matcher";
import { SubstringMatcher } from "@/services/substring-matcher";
import { ENTITY_TYPE, MATCH_FIELD, SEARCH_SNIPPET } from "@/constants";
import { createMockPage } from "../mocks/dataview-mock";

/** Builds a rank input from a name and optional body text; the type is incidental here. */
function input(name: string, body = ""): RankInput {
  return {
    candidate: { page: createMockPage({ path: `clients/${name}.md` }), type: ENTITY_TYPE.CLIENT },
    text: { [MATCH_FIELD.NAME]: name, [MATCH_FIELD.BODY]: body },
  };
}

/**
 * The two-field descriptor list the ranker consumes: name at tier 0 (no snippet),
 * body at tier 1 (snippet). Each field is scored with its own matcher, so a test
 * can drive name and body matching independently.
 */
function fields(nameMatcher: ITextMatcher, bodyMatcher: ITextMatcher): SearchField[] {
  return [
    { field: MATCH_FIELD.NAME, matcher: nameMatcher, buildsSnippet: false },
    { field: MATCH_FIELD.BODY, matcher: bodyMatcher, buildsSnippet: true },
  ];
}

/** One text's fake match: a score and optional offsets. */
interface FakeMatch {
  score: number;
  matches?: Array<[number, number]>;
}

/** A matcher driven by an explicit text → match map; a missing (or null) text is a non-match. */
function fakeMatcher(byText: Record<string, FakeMatch | null>): ITextMatcher {
  return {
    prepare: () => (text) => {
      const match = byText[text];
      return match ? { score: match.score, matches: match.matches ?? [] } : null;
    },
  };
}

const rankedNames = (ranked: { page: { file: { name: string } } }[]): string[] =>
  ranked.map((r) => r.page.file.name);

describe("rankCandidates — name tier", () => {
  it("orders matches by descending score and excludes non-matches", () => {
    const inputs = [input("Alpha"), input("Bravo"), input("Charlie"), input("Delta")];
    const matcher = fakeMatcher({ Alpha: { score: 3 }, Bravo: null, Charlie: { score: 10 }, Delta: { score: 7 } });

    const ranked = rankCandidates(inputs, "x", fields(matcher, matcher));

    expect(rankedNames(ranked)).toEqual(["Charlie", "Delta", "Alpha"]);
  });

  it("breaks equal-score ties alphabetically by name", () => {
    const inputs = [input("Charlie"), input("Alpha"), input("Bravo")];
    const matcher = fakeMatcher({ Alpha: { score: 5 }, Bravo: { score: 5 }, Charlie: { score: 5 } });

    expect(rankedNames(rankCandidates(inputs, "x", fields(matcher, matcher)))).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("returns an empty list when nothing matches", () => {
    const matcher = fakeMatcher({ Alpha: null, Bravo: null });
    expect(rankCandidates([input("Alpha"), input("Bravo")], "x", fields(matcher, matcher))).toEqual([]);
  });

  it("keeps a zero score (only null is a non-match)", () => {
    const matcher = fakeMatcher({ Alpha: { score: 0 } });
    const ranked = rankCandidates([input("Alpha")], "x", fields(matcher, matcher));
    expect(rankedNames(ranked)).toEqual(["Alpha"]);
  });

  it("prepares each field's query once and reuses the scorer across candidates", () => {
    let namePrepareCalls = 0;
    const nameMatcher: ITextMatcher = {
      prepare: () => {
        namePrepareCalls += 1;
        return (text) => ({ score: text.length, matches: [] });
      },
    };
    // Every candidate matches by name, so the body matcher never scores — but the
    // name matcher must still be prepared once, not once per candidate.
    rankCandidates(
      [input("Alpha"), input("Bravo"), input("Charlie")],
      "x",
      fields(nameMatcher, fakeMatcher({}))
    );

    expect(namePrepareCalls).toBe(1);
  });

  it("carries no snippet for a name match, even when the body also matches", () => {
    const matcher = fakeMatcher({ Acme: { score: 5 }, "acme in the body": { score: 2, matches: [[0, 4]] } });

    const [ranked] = rankCandidates([input("Acme", "acme in the body")], "acme", fields(matcher, matcher));

    expect(ranked.snippet).toBeUndefined();
  });
});

describe("rankCandidates — body tier", () => {
  it("ranks every name match above every body-only match", () => {
    // "Acme" matches by name; "Zephyr" only by body.
    const inputs = [input("Zephyr", "acme is mentioned here"), input("Acme", "")];
    const matcher = fakeMatcher({
      Acme: { score: 1 }, // low name score — still outranks the body match
      "acme is mentioned here": { score: 99, matches: [[0, 4]] }, // high body score — still below name tier
    });

    const ranked = rankCandidates(inputs, "acme", fields(matcher, matcher));

    expect(rankedNames(ranked)).toEqual(["Acme", "Zephyr"]);
    expect(ranked[0].snippet).toBeUndefined();
    expect(ranked[1].snippet?.text).toContain("acme");
  });

  it("orders body-only matches by descending score within their tier", () => {
    const inputs = [input("One", "low body match"), input("Two", "high body match")];
    const matcher = fakeMatcher({
      "low body match": { score: 2, matches: [[0, 3]] },
      "high body match": { score: 8, matches: [[0, 4]] },
    });

    expect(rankedNames(rankCandidates(inputs, "x", fields(matcher, matcher)))).toEqual(["Two", "One"]);
  });

  it("attaches a highlighted snippet built from the body match offsets", () => {
    const body = "the meeting decided on pineapple procurement";
    const matcher = fakeMatcher({ [body]: { score: 5, matches: [[23, 32]] } });

    const [ranked] = rankCandidates([input("Note", body)], "pineapple", fields(matcher, matcher));

    expect(ranked.snippet?.text).toContain("pineapple");
    expect(ranked.snippet?.matches).toEqual([[23, 32]]);
  });

  it("excludes a long body that contains the query only as a gapped subsequence (strict body matcher)", () => {
    // The letters e-x-e-c-u-t-e appear in order across the body, but the word
    // "execute" never occurs — a fuzzy subsequence match, not a real substring.
    const body =
      "Everyone expected the extra crew to unite around the target early, " +
      "yet the exact cadence remained unclear.";
    const nameMatcher = fakeMatcher({}); // no name match; the body decides
    const bodyMatcher = new SubstringMatcher();

    const ranked = rankCandidates([input("Runbook", body)], "execute", [
      { field: MATCH_FIELD.NAME, matcher: nameMatcher, buildsSnippet: false },
      { field: MATCH_FIELD.BODY, matcher: bodyMatcher, buildsSnippet: true },
    ]);

    expect(ranked).toEqual([]);
  });
});

describe("SubstringMatcher", () => {
  const matcher = new SubstringMatcher();

  it("matches the earliest occurrence as a single run and scores it by negated index", () => {
    const scorer = matcher.prepare("acme");
    const body = "see acme now";

    expect(scorer(body)).toEqual({ score: -4, matches: [[4, 8]] });
  });

  it("scores an occurrence at index 0 highest", () => {
    const scorer = matcher.prepare("acme");
    expect(scorer("acme corp")).toEqual({ score: 0, matches: [[0, 4]] });
  });

  it("matches case-insensitively", () => {
    const scorer = matcher.prepare("ACME");
    expect(scorer("the Acme file")).toEqual({ score: -4, matches: [[4, 8]] });
  });

  it("matches a query with regex-special characters literally", () => {
    const scorer = matcher.prepare("a.c");
    // The '.' is literal, so "a.c" matches "a.c" but not "abc".
    expect(scorer("abc")).toBeNull();
    expect(scorer("x a.c y")).toEqual({ score: -2, matches: [[2, 5]] });
  });

  it("reports offsets into the original text, framing the occurrence in its own casing", () => {
    const body = "See ACME Corp";
    const result = matcher.prepare("acme")(body);
    const [[start, end]] = result?.matches ?? [[0, 0]];
    // The run indexes the original text, so slicing it back yields the real occurrence.
    expect(body.slice(start, end)).toBe("ACME");
  });

  it("returns null when the query does not occur", () => {
    expect(matcher.prepare("acme")("globex only")).toBeNull();
  });

  it("returns null for an empty query", () => {
    expect(matcher.prepare("")("any body text")).toBeNull();
  });

  it("ranks an earlier occurrence above a later one", () => {
    const nameMatcher = fakeMatcher({});
    const ranked = rankCandidates(
      [input("Early", "acme appears right away"), input("Late", "long preamble then acme")],
      "acme",
      fields(nameMatcher, matcher)
    );

    expect(rankedNames(ranked)).toEqual(["Early", "Late"]);
  });
});

describe("buildBodySnippet", () => {
  it("returns the whole body unwindowed when it fits, with translated offsets", () => {
    const body = "aaaa pineapple bbbb";
    const snippet = buildBodySnippet(body, [[5, 14]]);

    expect(snippet).toEqual({ text: body, matches: [[5, 14]] });
  });

  it("windows a long body around the first match and ellipsises both clipped edges", () => {
    const body = "x".repeat(200) + "pineapple" + "y".repeat(200); // match at [200, 209)
    const snippet = buildBodySnippet(body, [[200, 209]])!;

    // A fixed window plus a leading and trailing ellipsis marker.
    expect(snippet.text.length).toBe(SEARCH_SNIPPET.WINDOW_CHARS + SEARCH_SNIPPET.ELLIPSIS.length * 2);
    expect(snippet.text.startsWith(SEARCH_SNIPPET.ELLIPSIS)).toBe(true);
    expect(snippet.text.endsWith(SEARCH_SNIPPET.ELLIPSIS)).toBe(true);
    // The highlighted run still frames the matched word.
    const [start, end] = snippet.matches[0];
    expect(snippet.text.slice(start, end)).toBe("pineapple");
  });

  it("returns null when there are no match runs (an empty query)", () => {
    expect(buildBodySnippet("some body text", [])).toBeNull();
  });

  it("keeps multiple match runs and translates each run's offsets", () => {
    const body = "alpha and beta here"; // fits in the window, so offsets are unchanged
    const snippet = buildBodySnippet(body, [[0, 5], [10, 14]]);

    expect(snippet).toEqual({ text: body, matches: [[0, 5], [10, 14]] });
  });

  it("clips a run straddling the window edge and drops runs beyond it", () => {
    const body = "x".repeat(200);
    // Three runs: one at the start, one straddling the 120-char window edge, one past it.
    const snippet = buildBodySnippet(body, [[0, 3], [118, 125], [150, 153]])!;

    // The straddling run is clipped to the window edge; the far run is dropped.
    expect(snippet.matches).toEqual([[0, 3], [118, 120]]);
    expect(snippet.text.endsWith(SEARCH_SNIPPET.ELLIPSIS)).toBe(true);
    expect(snippet.text.startsWith(SEARCH_SNIPPET.ELLIPSIS)).toBe(false);
  });
});

describe("PreparedFuzzyMatcher", () => {
  const matcher = new PreparedFuzzyMatcher();

  it("scores a contiguous match higher than a gapped one and drops a non-match", () => {
    const inputs = [input("Acme"), input("Globex"), input("Apex Acme Ltd")];

    const ranked = rankCandidates(inputs, "acme", fields(matcher, matcher));

    // "Acme" (contiguous, at start) outranks "Apex Acme Ltd" (later, gapped);
    // "Globex" has no "a"-"c"-"m"-"e" subsequence and is excluded.
    expect(rankedNames(ranked)).toEqual(["Acme", "Apex Acme Ltd"]);
  });

  it("returns a score and match offsets for a hit, and null for a miss", () => {
    const scorer = matcher.prepare("acme");
    const hit = scorer("Acme");
    expect(hit?.score).toBeTypeOf("number");
    expect(hit?.matches.length).toBeGreaterThan(0);
    expect(scorer("Globex")).toBeNull();
  });
});
