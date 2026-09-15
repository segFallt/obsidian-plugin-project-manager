import { describe, it, expect } from "vitest";
import { buildRaidFilterSpec, buildRaidFilterState } from "@/services/raid-filter";
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
