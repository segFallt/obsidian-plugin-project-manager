import { describe, it, expect } from "vitest";
import { buildReferenceFilterSpec, buildReferenceFilterState } from "@/services/reference-filter";
import { FilterEngine } from "@/services/filter-engine";
import { normalizeToName } from "@/utils/link-utils";
import type { DataviewPage, ReferenceFilters } from "@/types";
import type { IEntityHierarchyService } from "@/services/interfaces";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeRef(overrides: Partial<{
  name: string;
  topics: string[];
  client: string;
  engagement: string;
}>): DataviewPage {
  const name = overrides.name ?? "Ref";
  return {
    file: { name, path: `reference/references/${name}.md` },
    topics: overrides.topics ?? [],
    client: overrides.client,
    engagement: overrides.engagement,
  } as unknown as DataviewPage;
}

/** Hierarchy service resolving the client from the direct wikilink field. */
const hierarchyService: IEntityHierarchyService = {
  resolveClientName: (page) => normalizeToName(page.client),
  resolveEngagementName: (page) => normalizeToName(page.engagement),
};

const deps = { hierarchyService };

function baseFilters(overrides: Partial<ReferenceFilters> = {}): ReferenceFilters {
  return {
    viewMode: "topic",
    topics: [],
    clients: [],
    engagements: [],
    searchText: "",
    selectedNode: undefined,
    ...overrides,
  };
}

function apply(items: DataviewPage[], filters: ReferenceFilters): DataviewPage[] {
  return FilterEngine.apply(items, buildReferenceFilterSpec(deps), buildReferenceFilterState(filters));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Reference FilterSpec", () => {
  it("empty filters keep every reference", () => {
    const items = [makeRef({ name: "A" }), makeRef({ name: "B" })];
    expect(apply(items, baseFilters())).toHaveLength(2);
  });

  it("filters by topic (OR within the dimension, normalized both sides)", () => {
    const arch = makeRef({ name: "Arch", topics: ["[[Architecture]]"] });
    const sec = makeRef({ name: "Sec", topics: ["[[Security]]"] });
    const design = makeRef({ name: "Design", topics: ["[[Design]]"] });
    const kept = apply([arch, sec, design], baseFilters({ topics: ["Architecture", "Security"] }));
    expect(kept.map((p) => p.file.name)).toEqual(expect.arrayContaining(["Arch", "Sec"]));
    expect(kept).toHaveLength(2);
  });

  it("accepts legacy wikilink topic filter values", () => {
    const arch = makeRef({ name: "Arch", topics: ["[[Architecture]]"] });
    const sec = makeRef({ name: "Sec", topics: ["[[Security]]"] });
    const kept = apply([arch, sec], baseFilters({ topics: ["[[Architecture]]"] }));
    expect(kept.map((p) => p.file.name)).toEqual(["Arch"]);
  });

  it("does not match a reference whose topics is not an array", () => {
    const bad = { file: { name: "Bad", path: "x.md" }, topics: "[[Architecture]]" } as unknown as DataviewPage;
    const kept = apply([bad], baseFilters({ topics: ["Architecture"] }));
    expect(kept).toHaveLength(0);
  });

  it("filters by resolved client name via the hierarchy service", () => {
    const acme = makeRef({ name: "Acme", client: "[[AcmeCo]]" });
    const other = makeRef({ name: "Other", client: "[[OtherCo]]" });
    const kept = apply([acme, other], baseFilters({ clients: ["AcmeCo"] }));
    expect(kept.map((p) => p.file.name)).toEqual(["Acme"]);
  });

  it("filters by engagement name (normalized)", () => {
    const a = makeRef({ name: "A", engagement: "[[AcmeCo Retainer]]" });
    const b = makeRef({ name: "B", engagement: "[[Other Engagement]]" });
    const kept = apply([a, b], baseFilters({ engagements: ["AcmeCo Retainer"] }));
    expect(kept.map((p) => p.file.name)).toEqual(["A"]);
  });

  it("ANDs across dimensions (topic AND client both must match)", () => {
    const r1 = makeRef({ name: "R1", topics: ["[[Architecture]]"], client: "[[OtherCo]]" });
    const r2 = makeRef({ name: "R2", topics: ["[[Design]]"], client: "[[AcmeCo]]" });
    const r3 = makeRef({ name: "R3", topics: ["[[Architecture]]"], client: "[[AcmeCo]]" });
    const kept = apply([r1, r2, r3], baseFilters({ topics: ["Architecture"], clients: ["AcmeCo"] }));
    expect(kept.map((p) => p.file.name)).toEqual(["R3"]);
  });

  it("filters by case-insensitive search over the file name", () => {
    const a = makeRef({ name: "Auth Flow RFC" });
    const b = makeRef({ name: "Rate Limiting" });
    const kept = apply([a, b], baseFilters({ searchText: "auth" }));
    expect(kept.map((p) => p.file.name)).toEqual(["Auth Flow RFC"]);
  });

  it("empty topic/client/engagement lists impose no constraint", () => {
    const items = [makeRef({ name: "A", topics: [] }), makeRef({ name: "B", topics: [] })];
    expect(apply(items, baseFilters())).toHaveLength(2);
  });

  it("specWithout('searchText') drops the search constraint", () => {
    const a = makeRef({ name: "Auth Flow RFC" });
    const b = makeRef({ name: "Rate Limiting" });
    const spec = buildReferenceFilterSpec(deps).specWithout("searchText");
    const kept = FilterEngine.apply([a, b], spec, buildReferenceFilterState(baseFilters({ searchText: "auth" })));
    expect(kept).toHaveLength(2);
  });
});
