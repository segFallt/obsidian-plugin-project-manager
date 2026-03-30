import { describe, it, expect, vi } from "vitest";
import { renderEngagementView } from "@/processors/reference-views/engagement-view-renderer";
import type { ReferenceProcessorServices } from "@/plugin-context";
import type { DataviewPage } from "@/types";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeRef(name: string, engagementName: string | null): DataviewPage {
  return {
    file: {
      name,
      path: `reference/references/${name}.md`,
      folder: "reference/references",
      link: { path: `reference/references/${name}.md` },
      tags: ["#reference"],
      mtime: { valueOf: () => Date.now(), toISO: () => new Date().toISOString() },
      tasks: {
        length: 0,
        values: [],
        where: vi.fn(),
        sort: vi.fn(),
        map: vi.fn(),
        filter: vi.fn(),
        // stub iterator — tasks are never iterated in these tests
        [Symbol.iterator]: (function* () {})(),
      },
    },
    topics: [],
    client: undefined,
    engagement: engagementName ? `[[${engagementName}]]` : undefined,
  } as unknown as DataviewPage;
}

function makeServices(
  allRefs: DataviewPage[],
  resolveEngagement: (ref: DataviewPage) => string | null
): ReferenceProcessorServices {
  return {
    queryService: {
      getReferences: vi.fn(() => allRefs),
    },
    hierarchyService: {
      resolveClientName: vi.fn(() => null),
      resolveEngagementName: vi.fn((ref: DataviewPage) => resolveEngagement(ref)),
    },
  } as unknown as ReferenceProcessorServices;
}

function renderView(
  allRefs: DataviewPage[],
  displayedRefs: DataviewPage[],
  resolveEngagement: (ref: DataviewPage) => string | null,
  selectedNode?: string
): { sidebar: HTMLElement; panel: HTMLElement } {
  const sidebar = document.createElement("div");
  const panel = document.createElement("div");
  const services = makeServices(allRefs, resolveEngagement);
  renderEngagementView(sidebar, panel, displayedRefs, services, selectedNode, vi.fn());
  return { sidebar, panel };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("renderEngagementView — sidebar alphabetical list", () => {
  it("renders engagements in alphabetical order in the sidebar", () => {
    const refs = [
      makeRef("Doc1", "Zebra Engagement"),
      makeRef("Doc2", "Alpha Engagement"),
      makeRef("Doc3", "Midway Engagement"),
    ];
    const resolveEngagement = (ref: DataviewPage) => {
      const map: Record<string, string> = {
        Doc1: "Zebra Engagement",
        Doc2: "Alpha Engagement",
        Doc3: "Midway Engagement",
      };
      return map[ref.file.name] ?? null;
    };
    const { sidebar } = renderView(refs, refs, resolveEngagement);

    const items = [...sidebar.querySelectorAll(".pm-ref-sidebar__item")].map(
      (el) => el.textContent
    );
    expect(items).toEqual(["Alpha Engagement", "Midway Engagement", "Zebra Engagement"]);
  });

  it("marks the selected engagement with the selected CSS class", () => {
    const refs = [makeRef("Doc1", "Alpha Engagement"), makeRef("Doc2", "Zebra Engagement")];
    const resolveEngagement = (ref: DataviewPage) =>
      ref.file.name === "Doc1" ? "Alpha Engagement" : "Zebra Engagement";
    const { sidebar } = renderView(refs, refs, resolveEngagement, "Alpha Engagement");

    const selected = sidebar.querySelectorAll(".pm-ref-sidebar__item--selected");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toBe("Alpha Engagement");
  });
});

describe("renderEngagementView — content panel grouped by engagement", () => {
  it("renders references grouped by engagement in the content panel", () => {
    const refs = [
      makeRef("Doc1", "Alpha Engagement"),
      makeRef("Doc2", "Alpha Engagement"),
      makeRef("Doc3", "Zebra Engagement"),
    ];
    const resolveEngagement = (ref: DataviewPage) => {
      const map: Record<string, string> = {
        Doc1: "Alpha Engagement",
        Doc2: "Alpha Engagement",
        Doc3: "Zebra Engagement",
      };
      return map[ref.file.name] ?? null;
    };
    const { panel } = renderView(refs, refs, resolveEngagement);

    const groupTitles = [...panel.querySelectorAll(".pm-ref-group__title")].map(
      (el) => el.textContent
    );
    expect(groupTitles).toContain("Alpha Engagement");
    expect(groupTitles).toContain("Zebra Engagement");
    expect(panel.textContent).toContain("Doc1");
    expect(panel.textContent).toContain("Doc2");
    expect(panel.textContent).toContain("Doc3");
  });

  it("shows empty state when no references match", () => {
    const { panel } = renderView([], [], () => null);
    expect(panel.querySelector(".pm-ref-empty")).not.toBeNull();
  });

  it("groups references without an engagement under Unassigned", () => {
    const refs = [makeRef("Doc1", null), makeRef("Doc2", "Alpha Engagement")];
    const resolveEngagement = (ref: DataviewPage) =>
      ref.file.name === "Doc2" ? "Alpha Engagement" : null;
    const { panel } = renderView(refs, refs, resolveEngagement);

    const groupTitles = [...panel.querySelectorAll(".pm-ref-group__title")].map(
      (el) => el.textContent
    );
    expect(groupTitles).toContain("Unassigned");
    expect(panel.textContent).toContain("Doc1");
  });

  it("filters content panel to selected engagement when a node is selected", () => {
    const refs = [makeRef("Doc1", "Alpha Engagement"), makeRef("Doc2", "Zebra Engagement")];
    const resolveEngagement = (ref: DataviewPage) =>
      ref.file.name === "Doc1" ? "Alpha Engagement" : "Zebra Engagement";
    const filtered = refs.filter((r) => resolveEngagement(r) === "Alpha Engagement");
    const { panel } = renderView(refs, filtered, resolveEngagement, "Alpha Engagement");

    expect(panel.textContent).toContain("Doc1");
    expect(panel.textContent).not.toContain("Doc2");
  });
});
