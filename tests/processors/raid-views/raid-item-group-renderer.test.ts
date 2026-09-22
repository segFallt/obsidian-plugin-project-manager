import { describe, it, expect, vi } from "vitest";
import { RaidItemGroupRenderer } from "@/processors/raid-views/raid-item-group-renderer";
import type { RaidRenderHelpers } from "@/processors/raid-views/raid-view-constants";
import type { ViewRenderContext } from "@/processors/view-renderer";
import type { DataviewPage, RaidDashboardFilters } from "@/types";

type RaidGroupCtx = ViewRenderContext<DataviewPage, RaidRenderHelpers, RaidDashboardFilters>;

function makeItem(overrides: Partial<{
  name: string;
  raidType: string;
  status: string;
  likelihood: string;
  impact: string;
  owner: unknown;
  raisedDate: unknown;
}>): DataviewPage {
  const name = overrides.name ?? "Item";
  return {
    file: { name, path: `raid/${name}.md`, link: { path: `raid/${name}.md` } },
    "raid-type": overrides.raidType ?? "Risk",
    status: overrides.status ?? "Open",
    likelihood: overrides.likelihood ?? "High",
    impact: overrides.impact ?? "High",
    owner: overrides.owner ?? "",
    "raised-date": overrides.raisedDate ?? "2025-01-01",
  } as unknown as DataviewPage;
}

function makeCtx(items: DataviewPage[]): RaidGroupCtx {
  return {
    container: document.createElement("div"),
    items,
    filters: {
      raidTypes: [], statusFilter: [], clientFilter: [], engagementFilter: [], searchText: "", matrixCell: null,
    },
    onFilterChange: vi.fn(),
    helpers: {},
  };
}

describe("RaidItemGroupRenderer", () => {
  const renderer = new RaidItemGroupRenderer();

  it("renders a count strip with per-type counts", () => {
    const ctx = makeCtx([
      makeItem({ name: "R1", raidType: "Risk" }),
      makeItem({ name: "A1", raidType: "Assumption" }),
      makeItem({ name: "A2", raidType: "Assumption" }),
    ]);
    renderer.render(ctx);
    const counts = ctx.container.querySelector(".pm-raid-dashboard__counts")?.textContent ?? "";
    expect(counts).toContain("Risks: 1");
    expect(counts).toContain("Assumptions: 2");
  });

  it("renders one table per non-empty RAID type", () => {
    const ctx = makeCtx([
      makeItem({ name: "R1", raidType: "Risk" }),
      makeItem({ name: "I1", raidType: "Issue" }),
    ]);
    renderer.render(ctx);
    expect(ctx.container.querySelectorAll(".raid-item-table")).toHaveLength(2);
  });

  it("computes the age pill from a Dataview DateTime object's .ts value", () => {
    const fiveDaysAgo = Date.now() - 5 * 86400000;
    const ctx = makeCtx([makeItem({ raisedDate: { ts: fiveDaysAgo } })]);
    renderer.render(ctx);
    expect(ctx.container.querySelector(".raid-age-pill")?.textContent).toBe("5d");
  });

  it("omits the age pill when raised-date is an unparseable string", () => {
    const ctx = makeCtx([makeItem({ raisedDate: "not-a-date" })]);
    renderer.render(ctx);
    expect(ctx.container.querySelector(".raid-age-pill")).toBeNull();
    expect(ctx.container.textContent).not.toContain("NaN");
  });

  it("renders owner initials (max two) from a DataviewLink owner", () => {
    const ctx = makeCtx([makeItem({ owner: { path: "people/John Smith.md" } })]);
    renderer.render(ctx);
    const avatar = ctx.container.querySelector(".raid-owner-avatar");
    expect(avatar?.textContent).toBe("JS");
    expect(avatar?.getAttribute("title")).toBe("John Smith");
  });

  it("omits the owner avatar when owner is empty", () => {
    const ctx = makeCtx([makeItem({ owner: "" })]);
    renderer.render(ctx);
    expect(ctx.container.querySelector(".raid-owner-avatar")).toBeNull();
  });
});
