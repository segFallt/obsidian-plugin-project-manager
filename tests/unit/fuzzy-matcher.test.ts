import { describe, it, expect } from "vitest";
import { rankCandidates, buildBodySnippet, type IFuzzyMatcher, type RankInput } from "@/services/fuzzy-matcher";
import { PreparedFuzzyMatcher } from "@/services/prepared-fuzzy-matcher";
import { ENTITY_TYPE, MATCH_FIELD, SEARCH_SNIPPET } from "@/constants";
import { createMockPage } from "../mocks/dataview-mock";

/** Builds a rank input from a name and optional body text; the type is incidental here. */
function input(name: string, body = ""): RankInput {
  return {
    candidate: { page: createMockPage({ path: `clients/${name}.md` }), type: ENTITY_TYPE.CLIENT },
    text: { [MATCH_FIELD.NAME]: name, [MATCH_FIELD.BODY]: body },
  };
}

/** One text's fake match: a score and optional offsets. */
interface FakeMatch {
  score: number;
  matches?: Array<[number, number]>;
}

/** A matcher driven by an explicit text → match map; a missing (or null) text is a non-match. */
function fakeMatcher(byText: Record<string, FakeMatch | null>): IFuzzyMatcher {
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

    const ranked = rankCandidates(inputs, "x", matcher);

    expect(rankedNames(ranked)).toEqual(["Charlie", "Delta", "Alpha"]);
  });

  it("breaks equal-score ties alphabetically by name", () => {
    const inputs = [input("Charlie"), input("Alpha"), input("Bravo")];
    const matcher = fakeMatcher({ Alpha: { score: 5 }, Bravo: { score: 5 }, Charlie: { score: 5 } });

    expect(rankedNames(rankCandidates(inputs, "x", matcher))).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("returns an empty list when nothing matches", () => {
    const matcher = fakeMatcher({ Alpha: null, Bravo: null });
    expect(rankCandidates([input("Alpha"), input("Bravo")], "x", matcher)).toEqual([]);
  });

  it("keeps a zero score (only null is a non-match)", () => {
    const ranked = rankCandidates([input("Alpha")], "x", fakeMatcher({ Alpha: { score: 0 } }));
    expect(rankedNames(ranked)).toEqual(["Alpha"]);
  });

  it("prepares the query once and reuses the scorer across candidates", () => {
    let prepareCalls = 0;
    const matcher: IFuzzyMatcher = {
      prepare: () => {
        prepareCalls += 1;
        return (text) => ({ score: text.length, matches: [] });
      },
    };

    rankCandidates([input("Alpha"), input("Bravo"), input("Charlie")], "x", matcher);

    expect(prepareCalls).toBe(1);
  });

  it("carries no snippet for a name match, even when the body also matches", () => {
    const matcher = fakeMatcher({ Acme: { score: 5 }, "acme in the body": { score: 2, matches: [[0, 4]] } });

    const [ranked] = rankCandidates([input("Acme", "acme in the body")], "acme", matcher);

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

    const ranked = rankCandidates(inputs, "acme", matcher);

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

    expect(rankedNames(rankCandidates(inputs, "x", matcher))).toEqual(["Two", "One"]);
  });

  it("attaches a highlighted snippet built from the body match offsets", () => {
    const body = "the meeting decided on pineapple procurement";
    const matcher = fakeMatcher({ [body]: { score: 5, matches: [[23, 32]] } });

    const [ranked] = rankCandidates([input("Note", body)], "pineapple", matcher);

    expect(ranked.snippet?.text).toContain("pineapple");
    expect(ranked.snippet?.matches).toEqual([[23, 32]]);
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

    const ranked = rankCandidates(inputs, "acme", matcher);

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
