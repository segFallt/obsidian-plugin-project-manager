import { describe, it, expect } from "vitest";
import { rankCandidatesByName, type IFuzzyMatcher } from "@/services/fuzzy-matcher";
import { PreparedFuzzyMatcher } from "@/services/prepared-fuzzy-matcher";
import { ENTITY_TYPE } from "@/constants";
import type { EntityCandidate } from "@/types";
import { createMockPage } from "../mocks/dataview-mock";

/** Builds a candidate whose file name drives ranking; the type is incidental here. */
function candidate(name: string): EntityCandidate {
  return { page: createMockPage({ path: `clients/${name}.md` }), type: ENTITY_TYPE.CLIENT };
}

/** A matcher driven by an explicit name → score map; a missing name is a non-match. */
function fakeMatcher(scores: Record<string, number | null>): IFuzzyMatcher {
  return { prepare: () => (text) => scores[text] ?? null };
}

describe("rankCandidatesByName", () => {
  it("orders matches by descending score and excludes non-matches", () => {
    const candidates = [candidate("Alpha"), candidate("Bravo"), candidate("Charlie"), candidate("Delta")];
    const matcher = fakeMatcher({ Alpha: 3, Bravo: null, Charlie: 10, Delta: 7 });

    const ranked = rankCandidatesByName(candidates, "x", matcher);

    expect(ranked.map((c) => c.page.file.name)).toEqual(["Charlie", "Delta", "Alpha"]);
  });

  it("returns an empty list when nothing matches", () => {
    const candidates = [candidate("Alpha"), candidate("Bravo")];
    const matcher = fakeMatcher({ Alpha: null, Bravo: null });

    expect(rankCandidatesByName(candidates, "x", matcher)).toEqual([]);
  });

  it("keeps a zero score (only null is a non-match)", () => {
    const ranked = rankCandidatesByName([candidate("Alpha")], "x", fakeMatcher({ Alpha: 0 }));
    expect(ranked.map((c) => c.page.file.name)).toEqual(["Alpha"]);
  });

  it("prepares the query once and reuses the scorer across candidates", () => {
    let prepareCalls = 0;
    const matcher: IFuzzyMatcher = {
      prepare: () => {
        prepareCalls += 1;
        return (text) => text.length;
      },
    };

    rankCandidatesByName([candidate("Alpha"), candidate("Bravo"), candidate("Charlie")], "x", matcher);

    expect(prepareCalls).toBe(1);
  });
});

describe("PreparedFuzzyMatcher", () => {
  const matcher = new PreparedFuzzyMatcher();

  it("scores a contiguous match higher than a gapped one and drops a non-match", () => {
    const candidates = [candidate("Acme"), candidate("Globex"), candidate("Apex Acme Ltd")];

    const ranked = rankCandidatesByName(candidates, "acme", matcher);

    // "Acme" (contiguous, at start) outranks "Apex Acme Ltd" (later, gapped);
    // "Globex" has no "a"-"c"-"m"-"e" subsequence and is excluded.
    expect(ranked.map((c) => c.page.file.name)).toEqual(["Acme", "Apex Acme Ltd"]);
  });

  it("returns null for a text missing the query subsequence", () => {
    expect(matcher.prepare("acme")("Globex")).toBeNull();
  });
});
