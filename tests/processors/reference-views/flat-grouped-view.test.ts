import { describe, it, expect, vi } from "vitest";
import { FlatGroupedViewRenderer } from "@/processors/reference-views/flat-grouped-view";
import { normalizeToName } from "@/utils/link-utils";
import { buildContext, makeRef } from "./render-helpers";
import type { DataviewPage } from "@/types";

const resolveClient = (ref: DataviewPage): string | null => normalizeToName(ref.client);
const resolveEngagement = (ref: DataviewPage): string | null => normalizeToName(ref.engagement);

function renderClient(
  allReferences: DataviewPage[],
  items: DataviewPage[],
  selectedNode?: string,
  onFilterChange = vi.fn()
): { sidebar: HTMLElement; panel: HTMLElement } {
  const { ctx, container } = buildContext({ items, allReferences, selectedNode, viewMode: "client", onFilterChange });
  new FlatGroupedViewRenderer("client", resolveClient).render(ctx);
  return {
    sidebar: container.querySelector(".pm-references__sidebar") as HTMLElement,
    panel: container.querySelector(".pm-references__panel") as HTMLElement,
  };
}

describe("FlatGroupedViewRenderer (client) — sidebar", () => {
  it("lists clients from the UNFILTERED node-set in alphabetical order", () => {
    const all = [
      makeRef("Doc1", { client: "Zebra Corp" }),
      makeRef("Doc2", { client: "Acme Inc" }),
      makeRef("Doc3", { client: "Midway Ltd" }),
    ];
    // items filtered down to one, but the sidebar still shows all clients
    const { sidebar } = renderClient(all, [all[1]]);
    const items = [...sidebar.querySelectorAll(".pm-ref-sidebar__item")].map((el) => el.textContent);
    expect(items).toEqual(["Acme Inc", "Midway Ltd", "Zebra Corp"]);
  });

  it("marks the selected client with the selected CSS class", () => {
    const all = [makeRef("Doc1", { client: "Acme Inc" }), makeRef("Doc2", { client: "Zebra Corp" })];
    const { sidebar } = renderClient(all, all, "Acme Inc");
    const selected = sidebar.querySelectorAll(".pm-ref-sidebar__item--selected");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toBe("Acme Inc");
  });

  it("emits a selectedNode patch on sidebar item click", () => {
    const onFilterChange = vi.fn();
    const all = [makeRef("Doc1", { client: "Acme Inc" })];
    const { sidebar } = renderClient(all, all, undefined, onFilterChange);
    (sidebar.querySelector(".pm-ref-sidebar__item") as HTMLElement).click();
    expect(onFilterChange).toHaveBeenCalledWith({ selectedNode: "Acme Inc" });
  });
});

describe("FlatGroupedViewRenderer (client) — content panel", () => {
  it("groups references by client", () => {
    const refs = [
      makeRef("Doc1", { client: "Acme Inc" }),
      makeRef("Doc2", { client: "Acme Inc" }),
      makeRef("Doc3", { client: "Zebra Corp" }),
    ];
    const { panel } = renderClient(refs, refs);
    const titles = [...panel.querySelectorAll(".pm-ref-group__title")].map((el) => el.textContent);
    expect(titles).toContain("Acme Inc");
    expect(titles).toContain("Zebra Corp");
    expect(panel.textContent).toContain("Doc1");
    expect(panel.textContent).toContain("Doc3");
  });

  it("shows an empty state when no references match", () => {
    const { panel } = renderClient([], []);
    expect(panel.querySelector(".pm-ref-empty")).not.toBeNull();
  });

  it("groups references without a client under Unassigned", () => {
    const refs = [makeRef("Doc1", {}), makeRef("Doc2", { client: "Acme Inc" })];
    const { panel } = renderClient(refs, refs);
    const titles = [...panel.querySelectorAll(".pm-ref-group__title")].map((el) => el.textContent);
    expect(titles).toContain("Unassigned");
    expect(panel.textContent).toContain("Doc1");
  });

  it("scopes the content to the selected client", () => {
    const refs = [makeRef("Doc1", { client: "Acme Inc" }), makeRef("Doc2", { client: "Zebra Corp" })];
    const { panel } = renderClient(refs, refs, "Acme Inc");
    expect(panel.textContent).toContain("Doc1");
    expect(panel.textContent).not.toContain("Doc2");
  });
});

describe("FlatGroupedViewRenderer (engagement)", () => {
  function renderEngagement(
    allReferences: DataviewPage[],
    items: DataviewPage[],
    selectedNode?: string
  ): { sidebar: HTMLElement; panel: HTMLElement } {
    const { ctx, container } = buildContext({ items, allReferences, selectedNode, viewMode: "engagement" });
    new FlatGroupedViewRenderer("engagement", resolveEngagement).render(ctx);
    return {
      sidebar: container.querySelector(".pm-references__sidebar") as HTMLElement,
      panel: container.querySelector(".pm-references__panel") as HTMLElement,
    };
  }

  it("lists engagements alphabetically and groups content", () => {
    const refs = [
      makeRef("Doc1", { engagement: "Zebra Engagement" }),
      makeRef("Doc2", { engagement: "Alpha Engagement" }),
    ];
    const { sidebar, panel } = renderEngagement(refs, refs);
    const items = [...sidebar.querySelectorAll(".pm-ref-sidebar__item")].map((el) => el.textContent);
    expect(items).toEqual(["Alpha Engagement", "Zebra Engagement"]);
    const titles = [...panel.querySelectorAll(".pm-ref-group__title")].map((el) => el.textContent);
    expect(titles).toContain("Alpha Engagement");
    expect(titles).toContain("Zebra Engagement");
  });

  it("groups references without an engagement under Unassigned", () => {
    const refs = [makeRef("Doc1", {}), makeRef("Doc2", { engagement: "Alpha Engagement" })];
    const { panel } = renderEngagement(refs, refs);
    const titles = [...panel.querySelectorAll(".pm-ref-group__title")].map((el) => el.textContent);
    expect(titles).toContain("Unassigned");
  });
});
