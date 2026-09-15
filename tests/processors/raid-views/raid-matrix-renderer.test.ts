import { describe, it, expect, vi } from "vitest";
import { RaidMatrixRenderer } from "@/processors/raid-views/raid-matrix-renderer";
import type { RaidRenderHelpers } from "@/processors/raid-views/raid-view-constants";
import type { ViewRenderContext } from "@/processors/view-renderer";
import type { DataviewPage, RaidDashboardFilters } from "@/types";

type RaidCtx = ViewRenderContext<DataviewPage, RaidRenderHelpers, RaidDashboardFilters>;

function cell(likelihood: string, impact: string): DataviewPage {
  return { file: { name: `${likelihood}-${impact}`, path: "raid/x.md" }, likelihood, impact } as unknown as DataviewPage;
}

function baseFilters(matrixCell: RaidDashboardFilters["matrixCell"] = null): RaidDashboardFilters {
  return {
    raidTypes: [],
    statusFilter: [],
    clientFilter: [],
    engagementFilter: [],
    searchText: "",
    matrixCell,
  };
}

function makeCtx(overrides: Partial<RaidCtx>): RaidCtx {
  return {
    container: document.createElement("div"),
    items: [],
    filters: baseFilters(),
    onFilterChange: vi.fn(),
    helpers: {},
    ...overrides,
  };
}

describe("RaidMatrixRenderer", () => {
  const renderer = new RaidMatrixRenderer();

  it("declares the matrixCell owned facet", () => {
    expect(renderer.ownsFacet).toBe("matrixCell");
  });

  it("renders a count in the High×High cell", () => {
    const ctx = makeCtx({ items: [cell("High", "High"), cell("High", "High")] });
    renderer.render(ctx);
    expect(ctx.container.querySelector(".raid-cell--hh")?.textContent).toBe("2");
  });

  it("counts from facetItems (all-other-facet set), not the filtered items", () => {
    const ctx = makeCtx({
      items: [cell("High", "High")], // fully filtered
      facetItems: [cell("High", "High"), cell("Low", "Low"), cell("Low", "Low")],
    });
    renderer.render(ctx);
    expect(ctx.container.querySelector(".raid-cell--hh")?.textContent).toBe("1");
    expect(ctx.container.querySelector(".raid-cell--ll")?.textContent).toBe("2");
  });

  it("keeps the other cells' counts when a cell is selected (deliberate improvement)", () => {
    // A High×High cell is selected: items are narrowed to it, but facetItems
    // (all facets except matrixCell) still carries the Low×Low item.
    const ctx = makeCtx({
      items: [cell("High", "High")],
      facetItems: [cell("High", "High"), cell("Low", "Low")],
      filters: baseFilters({ likelihood: "High", impact: "High" }),
    });
    renderer.render(ctx);
    const hh = ctx.container.querySelector(".raid-cell--hh");
    const ll = ctx.container.querySelector(".raid-cell--ll");
    expect(hh?.textContent).toBe("1");
    expect(hh?.classList.contains("raid-matrix-cell--selected")).toBe(true);
    // Not zeroed even though it is outside the selected cell.
    expect(ll?.textContent).toBe("1");
  });

  it("emits onFilterChange with the clicked cell", () => {
    const onFilterChange = vi.fn();
    const ctx = makeCtx({ items: [cell("Low", "High")], onFilterChange });
    renderer.render(ctx);
    (ctx.container.querySelector(".raid-cell--lh") as HTMLElement).click();
    expect(onFilterChange).toHaveBeenCalledWith({ matrixCell: { likelihood: "Low", impact: "High" } });
  });

  it("clears the selection when the active cell is clicked again", () => {
    const onFilterChange = vi.fn();
    const ctx = makeCtx({
      items: [cell("Low", "High")],
      filters: baseFilters({ likelihood: "Low", impact: "High" }),
      onFilterChange,
    });
    renderer.render(ctx);
    (ctx.container.querySelector(".raid-cell--lh") as HTMLElement).click();
    expect(onFilterChange).toHaveBeenCalledWith({ matrixCell: null });
  });
});
