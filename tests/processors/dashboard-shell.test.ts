import { describe, it, expect, vi } from "vitest";
import { DashboardShell } from "../../src/processors/dashboard-shell";
import type { DashboardShellDeps } from "../../src/processors/dashboard-shell";
import { createFilterSpec } from "../../src/services/filter-engine";
import type { FilterState } from "../../src/services/filter-engine";
import type { IViewRenderer, ViewRenderContext } from "../../src/processors/view-renderer";
import type { DashboardFilters } from "../../src/types";

// ─── Plain fakes (no Obsidian, no Dataview) ──────────────────────────────────

interface Item {
  id: number;
  kind: string;
  group: string;
}

interface Helpers {
  marker: string;
}

const ITEMS: Item[] = [
  { id: 1, kind: "a", group: "g1" },
  { id: 2, kind: "b", group: "g1" },
  { id: 3, kind: "a", group: "g2" },
];

const SPEC = createFilterSpec<Item>([
  { key: "kind", accessor: (i) => i.kind },
  { key: "group", accessor: (i) => i.group },
]);

/** A passive renderer that appends one <span> per item and records its context. */
function passiveRenderer(mode: string): {
  renderer: IViewRenderer<Item, Helpers>;
  lastCtx: () => ViewRenderContext<Item, Helpers> | null;
} {
  let seen: ViewRenderContext<Item, Helpers> | null = null;
  return {
    renderer: {
      mode,
      render(ctx): void {
        seen = ctx;
        for (const item of ctx.items) ctx.container.createEl("span", { text: String(item.id) });
      },
    },
    lastCtx: () => seen,
  };
}

/** An interactive renderer that declares an owned facet and records its context. */
function facetRenderer(mode: string, ownsFacet: string): {
  renderer: IViewRenderer<Item, Helpers>;
  lastCtx: () => ViewRenderContext<Item, Helpers> | null;
} {
  let seen: ViewRenderContext<Item, Helpers> | null = null;
  return {
    renderer: {
      mode,
      ownsFacet,
      render(ctx): void {
        seen = ctx;
      },
    },
    lastCtx: () => seen,
  };
}

function baseDeps(
  overrides: Partial<DashboardShellDeps<Item, Helpers>>
): DashboardShellDeps<Item, Helpers> {
  const state: FilterState = { selections: {}, viewMode: "main" };
  return {
    query: { resolve: () => ITEMS },
    views: {},
    getViewMode: () => "main",
    getFilters: () => ({}) as DashboardFilters,
    buildSpec: () => SPEC,
    buildState: () => state,
    buildHelpers: () => ({ marker: "built" }),
    onFilterChange: vi.fn(),
    emptyMessage: "nothing here",
    onUnknownMode: vi.fn(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DashboardShell", () => {
  it("resolves, filters, and renders the active view into the container", async () => {
    const { renderer, lastCtx } = passiveRenderer("main");
    const container = document.createElement("div");

    const shell = new DashboardShell<Item, Helpers>(
      baseDeps({
        views: { main: renderer },
        // Select group g1 → keeps items 1 and 2.
        buildState: () => ({ selections: { group: ["g1"] }, viewMode: "main" }),
      })
    );

    await shell.render(container);

    expect(container.querySelectorAll("span")).toHaveLength(2);
    const ctx = lastCtx();
    expect(ctx).not.toBeNull();
    expect(ctx!.items.map((i) => i.id)).toEqual([1, 2]);
    expect(ctx!.helpers.marker).toBe("built");
    // Passive renderer gets no facetItems.
    expect(ctx!.facetItems).toBeUndefined();
  });

  it("empties the container before each render", async () => {
    const { renderer } = passiveRenderer("main");
    const container = document.createElement("div");
    container.createEl("span", { text: "stale" });

    const shell = new DashboardShell<Item, Helpers>(baseDeps({ views: { main: renderer } }));
    await shell.render(container);

    // The stale span is gone; only freshly-rendered spans remain (3 items, no filter).
    expect(container.querySelectorAll("span")).toHaveLength(3);
  });

  it("shows the empty message when nothing matches the filters", async () => {
    const { renderer, lastCtx } = passiveRenderer("main");
    const container = document.createElement("div");

    const shell = new DashboardShell<Item, Helpers>(
      baseDeps({
        views: { main: renderer },
        // No item has kind "zzz" → filtered set is empty.
        buildState: () => ({ selections: { kind: ["zzz"] }, viewMode: "main" }),
      })
    );

    await shell.render(container);

    const em = container.querySelector("em");
    expect(em).not.toBeNull();
    expect(em!.textContent).toBe("nothing here");
    // Renderer never ran.
    expect(lastCtx()).toBeNull();
  });

  it("dispatches to the renderer on an empty set when renderWhenEmpty is set", async () => {
    const { renderer, lastCtx } = passiveRenderer("main");
    const container = document.createElement("div");

    const shell = new DashboardShell<Item, Helpers>(
      baseDeps({
        views: { main: renderer },
        // No item matches → filtered set is empty, but renderWhenEmpty keeps the renderer running.
        buildState: () => ({ selections: { kind: ["zzz"] }, viewMode: "main" }),
        renderWhenEmpty: true,
      })
    );

    await shell.render(container);

    // No empty-message short-circuit; the renderer ran with an empty item set.
    expect(container.querySelector("em")).toBeNull();
    const ctx = lastCtx();
    expect(ctx).not.toBeNull();
    expect(ctx!.items).toEqual([]);
  });

  it("invokes onUnknownMode when the active view mode has no renderer", async () => {
    const onUnknownMode = vi.fn();
    const container = document.createElement("div");

    const shell = new DashboardShell<Item, Helpers>(
      baseDeps({
        views: { main: passiveRenderer("main").renderer },
        getViewMode: () => "missing",
        onUnknownMode,
      })
    );

    await shell.render(container);

    expect(onUnknownMode).toHaveBeenCalledWith(container, "missing");
  });

  it("feeds a renderer's ctx.facetItems with items filtered by all OTHER facets", async () => {
    const { renderer, lastCtx } = facetRenderer("main", "kind");
    const container = document.createElement("div");

    const shell = new DashboardShell<Item, Helpers>(
      baseDeps({
        views: { main: renderer },
        // Select kind a AND group g1.
        buildState: () => ({ selections: { kind: ["a"], group: ["g1"] }, viewMode: "main" }),
      })
    );

    await shell.render(container);

    const ctx = lastCtx();
    expect(ctx).not.toBeNull();
    // Fully filtered (kind a AND group g1) → only item 1.
    expect(ctx!.items.map((i) => i.id)).toEqual([1]);
    // facetItems ignores the owned "kind" facet → group g1 items 1 and 2.
    expect(ctx!.facetItems).toBeDefined();
    expect(ctx!.facetItems!.map((i) => i.id)).toEqual([1, 2]);
  });
});
