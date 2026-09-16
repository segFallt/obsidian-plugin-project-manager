import { describe, it, expect } from "vitest";
import {
  buildRaidFilterSpec,
  buildRaidFilterState,
  isActiveRaid,
  matchesRaidContext,
} from "@/services/raid-filter";
import { FilterEngine } from "@/services/filter-engine";
import type { DataviewPage, RaidDashboardFilters } from "@/types";
import type { IEntityHierarchyService } from "@/services/interfaces";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<{
  name: string;
  raidType: string;
  status: string;
  likelihood: string;
  impact: string;
  client: string;
  engagement: string;
}>): DataviewPage {
  const name = overrides.name ?? "Item";
  return {
    file: { name, path: `raid/${name}.md` },
    "raid-type": overrides.raidType ?? "Risk",
    status: overrides.status ?? "Open",
    likelihood: overrides.likelihood ?? "High",
    impact: overrides.impact ?? "High",
    client: overrides.client,
    engagement: overrides.engagement,
  } as unknown as DataviewPage;
}

/** Hierarchy service that reads the plain string client/engagement fields. */
const hierarchyService: IEntityHierarchyService = {
  resolveClientName: (page) => (page.client ? String(page.client) : null),
  resolveEngagementName: (page) => (page.engagement ? String(page.engagement) : null),
};

const deps = { hierarchyService };

function baseFilters(overrides: Partial<RaidDashboardFilters> = {}): RaidDashboardFilters {
  return {
    raidTypes: [],
    statusFilter: [],
    clientFilter: [],
    engagementFilter: [],
    searchText: "",
    matrixCell: null,
    ...overrides,
  };
}

function apply(items: DataviewPage[], filters: RaidDashboardFilters): DataviewPage[] {
  return FilterEngine.apply(items, buildRaidFilterSpec(deps), buildRaidFilterState(filters));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("RAID FilterSpec", () => {
  const risk = makeItem({ name: "Risk", raidType: "Risk", status: "Open" });
  const issue = makeItem({ name: "Issue", raidType: "Issue", status: "Closed" });
  const items = [risk, issue];

  it("empty filters keep every item", () => {
    expect(apply(items, baseFilters())).toHaveLength(2);
  });

  it("filters by RAID type", () => {
    const kept = apply(items, baseFilters({ raidTypes: ["Risk"] }));
    expect(kept.map((p) => p.file.name)).toEqual(["Risk"]);
  });

  it("filters by status", () => {
    const kept = apply(items, baseFilters({ statusFilter: ["Closed"] }));
    expect(kept.map((p) => p.file.name)).toEqual(["Issue"]);
  });

  it("filters by resolved client name via the hierarchy service", () => {
    const acme = makeItem({ name: "Acme", client: "Acme Corp" });
    const beta = makeItem({ name: "Beta", client: "Beta Ltd" });
    const kept = apply([acme, beta], baseFilters({ clientFilter: ["Acme Corp"] }));
    expect(kept.map((p) => p.file.name)).toEqual(["Acme"]);
  });

  it("filters by resolved engagement name via the hierarchy service", () => {
    const alpha = makeItem({ name: "Alpha", engagement: "Alpha Project" });
    const gamma = makeItem({ name: "Gamma", engagement: "Gamma Project" });
    const kept = apply([alpha, gamma], baseFilters({ engagementFilter: ["Alpha Project"] }));
    expect(kept.map((p) => p.file.name)).toEqual(["Alpha"]);
  });

  it("filters by case-insensitive search over the file name", () => {
    const kept = apply(items, baseFilters({ searchText: "iss" }));
    expect(kept.map((p) => p.file.name)).toEqual(["Issue"]);
  });

  it("filters by the selected matrix cell (likelihood × impact)", () => {
    const hiHi = makeItem({ name: "HiHi", likelihood: "High", impact: "High" });
    const loLo = makeItem({ name: "LoLo", likelihood: "Low", impact: "Low" });
    const kept = apply([hiHi, loLo], baseFilters({ matrixCell: { likelihood: "High", impact: "High" } }));
    expect(kept.map((p) => p.file.name)).toEqual(["HiHi"]);
  });

  it("specWithout('matrixCell') drops the matrix-cell constraint (the shell's count set)", () => {
    const hiHi = makeItem({ name: "HiHi", likelihood: "High", impact: "High" });
    const loLo = makeItem({ name: "LoLo", likelihood: "Low", impact: "Low" });
    const filters = baseFilters({ matrixCell: { likelihood: "High", impact: "High" } });
    const spec = buildRaidFilterSpec(deps).specWithout("matrixCell");
    const kept = FilterEngine.apply([hiHi, loLo], spec, buildRaidFilterState(filters));
    expect(kept.map((p) => p.file.name)).toEqual(["HiHi", "LoLo"]);
  });
});

// ─── Standalone predicates ─────────────────────────────────────────────────

describe("isActiveRaid", () => {
  it("treats Open and In Progress as active", () => {
    expect(isActiveRaid(makeItem({ status: "Open" }))).toBe(true);
    expect(isActiveRaid(makeItem({ status: "In Progress" }))).toBe(true);
  });

  it("treats Resolved and Closed as inactive", () => {
    expect(isActiveRaid(makeItem({ status: "Resolved" }))).toBe(false);
    expect(isActiveRaid(makeItem({ status: "Closed" }))).toBe(false);
  });

  it("treats a missing status as active", () => {
    const item = { file: { name: "NoStatus", path: "raid/NoStatus.md" } } as unknown as DataviewPage;
    expect(isActiveRaid(item)).toBe(true);
  });
});

describe("matchesRaidContext", () => {
  it("matches on the client leg via resolved client name", () => {
    const item = makeItem({ client: "Acme Corp" });
    expect(matchesRaidContext(item, "Acme Corp", undefined, hierarchyService)).toBe(true);
    expect(matchesRaidContext(item, "Other Co", undefined, hierarchyService)).toBe(false);
  });

  it("matches on the engagement leg via the direct engagement field", () => {
    const item = makeItem({ engagement: "Alpha Project" });
    expect(matchesRaidContext(item, undefined, "Alpha Project", hierarchyService)).toBe(true);
    expect(matchesRaidContext(item, undefined, "Gamma Project", hierarchyService)).toBe(false);
  });

  it("is an OR: either leg matching passes", () => {
    const item = makeItem({ client: "Acme Corp", engagement: "Alpha Project" });
    // client mismatches but engagement matches → still passes
    expect(matchesRaidContext(item, "Other Co", "Alpha Project", hierarchyService)).toBe(true);
    // engagement mismatches but client matches → still passes
    expect(matchesRaidContext(item, "Acme Corp", "Gamma Project", hierarchyService)).toBe(true);
  });

  it("does not match when both names are empty/undefined", () => {
    const item = makeItem({ client: "Acme Corp", engagement: "Alpha Project" });
    expect(matchesRaidContext(item, undefined, undefined, hierarchyService)).toBe(false);
    expect(matchesRaidContext(item, "", "", hierarchyService)).toBe(false);
  });

  it("compares names normalised, so wikilink and plain formats match", () => {
    const item = makeItem({ engagement: "Alpha Project" });
    expect(matchesRaidContext(item, undefined, "[[Alpha Project]]", hierarchyService)).toBe(true);
  });
});
