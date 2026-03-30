import { describe, it, expect, vi } from "vitest";
import { renderTopicView } from "@/processors/reference-views/topic-view-renderer";
import type { ReferenceProcessorServices } from "@/plugin-context";
import type { DataviewPage, TopicNode } from "@/types";

// ─── Factories ────────────────────────────────────────────────────────────────

function makeRef(name: string, topics: string[]): DataviewPage {
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
        [Symbol.iterator]: [][Symbol.iterator],
      },
    },
    topics: topics.map((t) => `[[${t}]]`),
    client: undefined,
    engagement: undefined,
  } as unknown as DataviewPage;
}

function makeNode(name: string, children: TopicNode[] = []): TopicNode {
  return { name, children };
}

function makeServices(tree: TopicNode[]): ReferenceProcessorServices {
  return {
    queryService: {
      getReferenceTopicTree: vi.fn(() => tree),
    },
  } as unknown as ReferenceProcessorServices;
}

function renderView(
  tree: TopicNode[],
  references: DataviewPage[],
  selectedNode?: string
): { sidebar: HTMLElement; panel: HTMLElement } {
  const sidebar = document.createElement("div");
  const panel = document.createElement("div");
  const services = makeServices(tree);
  renderTopicView(sidebar, panel, references, services, selectedNode, vi.fn());
  return { sidebar, panel };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("renderTopicView — sidebar tree DOM nesting (Bug 1 regression)", () => {
  it("renders a leaf node with no children container", () => {
    const tree = [makeNode("Technology")];
    const { sidebar } = renderView(tree, []);
    const itemEl = sidebar.querySelector(".pm-ref-tree__item");
    expect(itemEl).not.toBeNull();
    // No children container for a leaf
    expect(itemEl!.querySelector(".pm-ref-tree__children")).toBeNull();
  });

  it("places the children container as a sibling of the label row, not inside the flex label row", () => {
    const tree = [makeNode("Technology", [makeNode("Kubernetes")])];
    const { sidebar } = renderView(tree, []);

    // The item wrapper contains both the label row and the children container
    const itemEl = sidebar.querySelector(".pm-ref-tree__item");
    expect(itemEl).not.toBeNull();

    const labelRowEl = itemEl!.querySelector(".pm-ref-tree__node");
    expect(labelRowEl).not.toBeNull();

    const childrenEl = itemEl!.querySelector(".pm-ref-tree__children");
    expect(childrenEl).not.toBeNull();

    // The children container must NOT be inside the flex label row
    expect(labelRowEl!.querySelector(".pm-ref-tree__children")).toBeNull();

    // The children container must NOT be a direct child of sidebar
    const directChildrenOfSidebar = [...sidebar.children].filter(
      (el) => el.classList.contains("pm-ref-tree__children")
    );
    expect(directChildrenOfSidebar).toHaveLength(0);
  });

  it("nests three levels deep correctly", () => {
    const tree = [makeNode("Technology", [makeNode("Kubernetes", [makeNode("Helm")])])];
    const { sidebar } = renderView(tree, []);

    const level1Item = sidebar.querySelector(".pm-ref-tree__item");
    expect(level1Item).not.toBeNull();

    const level1Children = level1Item!.querySelector(".pm-ref-tree__children");
    expect(level1Children).not.toBeNull();

    const level2Item = level1Children!.querySelector(".pm-ref-tree__item");
    expect(level2Item).not.toBeNull();

    const level2Children = level2Item!.querySelector(".pm-ref-tree__children");
    expect(level2Children).not.toBeNull();

    const level3Item = level2Children!.querySelector(".pm-ref-tree__item");
    expect(level3Item).not.toBeNull();
    expect(level3Item!.textContent).toContain("Helm");
  });

  it("renders multiple root nodes at the top level", () => {
    const tree = [makeNode("Technology"), makeNode("Architecture")];
    const { sidebar } = renderView(tree, []);
    const topLevelItems = [...sidebar.children].filter((el) =>
      el.classList.contains("pm-ref-tree__item")
    );
    expect(topLevelItems).toHaveLength(2);
  });

  it("marks the selected node with the selected CSS class", () => {
    const tree = [makeNode("Technology", [makeNode("Kubernetes")])];
    const { sidebar } = renderView(tree, [], "Technology");
    const selected = sidebar.querySelectorAll(".pm-ref-tree__node--selected");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain("Technology");
  });

  it("renders expand/collapse toggle only for nodes with children", () => {
    const tree = [makeNode("Technology", [makeNode("Kubernetes")]), makeNode("Other")];
    const { sidebar } = renderView(tree, []);

    const nodes = sidebar.querySelectorAll(".pm-ref-tree__node");
    // Technology (has children) should have ▾ toggle; Other (leaf) should have space
    const technologyToggle = nodes[0].querySelector(".pm-ref-tree__toggle");
    const otherToggle = nodes[1].querySelector(".pm-ref-tree__toggle");
    expect(technologyToggle?.textContent).toBe("▾");
    expect(otherToggle?.textContent).toBe(" ");
  });

  it("the label row (.pm-ref-tree__node) contains only the toggle and name, not the children container", () => {
    const tree = [makeNode("Technology", [makeNode("Kubernetes")])];
    const { sidebar } = renderView(tree, []);

    const labelRowEl = sidebar.querySelector(".pm-ref-tree__node");
    expect(labelRowEl).not.toBeNull();

    // The flex label row must NOT contain the children container
    expect(labelRowEl!.querySelector(".pm-ref-tree__children")).toBeNull();

    // The label row has exactly 2 child elements: toggle span and name span
    expect(labelRowEl!.children).toHaveLength(2);
  });
});

describe("renderTopicView — content panel default (hierarchical) view (Bug 2 regression)", () => {
  it("renders nested groups for root topics when no node is selected", () => {
    const tree = [makeNode("Technology", [makeNode("Kubernetes")])];
    const refs = [
      makeRef("Book A", ["Technology"]),
      makeRef("Book B", ["Kubernetes"]),
    ];
    const { panel } = renderView(tree, refs);

    // Top-level group for "Technology"
    const groups = panel.querySelectorAll(".pm-ref-group");
    expect(groups.length).toBeGreaterThanOrEqual(1);

    const groupTitles = [...panel.querySelectorAll(".pm-ref-group__title")].map(
      (el) => el.textContent
    );
    expect(groupTitles).toContain("Technology");
    // Kubernetes should appear as a nested group inside Technology
    expect(groupTitles).toContain("Kubernetes");
  });

  it("does NOT show all topics as a flat alphabetical list when tree has hierarchy", () => {
    const tree = [makeNode("Technology", [makeNode("Kubernetes")])];
    const refs = [
      makeRef("Book A", ["Technology"]),
      makeRef("Book B", ["Kubernetes"]),
    ];
    const { panel } = renderView(tree, refs);

    // In the correct (hierarchical) rendering, "Kubernetes" group is nested INSIDE
    // the "Technology" group body — not at the top level of the panel.
    const topLevelGroups = [...panel.children].filter((el) =>
      el.classList.contains("pm-ref-group")
    );
    // Only Technology should be a direct child group of the panel
    expect(topLevelGroups).toHaveLength(1);
    expect(topLevelGroups[0].querySelector(".pm-ref-group__title")?.textContent).toBe("Technology");
  });

  it("falls back to flat groups when the topic tree is empty", () => {
    const refs = [
      makeRef("Book A", ["Architecture"]),
      makeRef("Book B", ["Testing"]),
    ];
    const { panel } = renderView([], refs);
    const groupTitles = [...panel.querySelectorAll(".pm-ref-group__title")].map(
      (el) => el.textContent
    );
    // Flat fallback: both topics appear as separate groups
    expect(groupTitles).toContain("Architecture");
    expect(groupTitles).toContain("Testing");
  });

  it("shows empty state when no references exist", () => {
    const tree = [makeNode("Technology")];
    const { panel } = renderView(tree, []);
    expect(panel.querySelector(".pm-ref-empty")).not.toBeNull();
  });

  it("scopes the content panel to the selected node's subtree when a node is selected", () => {
    const tree = [makeNode("Technology", [makeNode("Kubernetes")]), makeNode("Architecture")];
    const refs = [
      makeRef("Book A", ["Technology"]),
      makeRef("Book B", ["Kubernetes"]),
      makeRef("Book C", ["Architecture"]),
    ];
    const { panel } = renderView(tree, refs, "Technology");

    // Architecture reference should NOT appear in the scoped view
    expect(panel.textContent).not.toContain("Book C");
    // Technology and Kubernetes references should appear
    expect(panel.textContent).toContain("Book A");
    expect(panel.textContent).toContain("Book B");
  });
});
