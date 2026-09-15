import { describe, it, expect, vi } from "vitest";
import { TopicViewRenderer } from "@/processors/reference-views/topic-view-renderer";
import { buildContext, makeRef, makeNode } from "./render-helpers";
import type { DataviewPage, TopicNode } from "@/types";

function render(
  topicTree: TopicNode[],
  items: DataviewPage[],
  selectedNode?: string,
  onFilterChange = vi.fn()
): { sidebar: HTMLElement; panel: HTMLElement; container: HTMLElement } {
  const { ctx, container } = buildContext({ items, topicTree, selectedNode, onFilterChange });
  new TopicViewRenderer().render(ctx);
  return {
    sidebar: container.querySelector(".pm-references__sidebar") as HTMLElement,
    panel: container.querySelector(".pm-references__panel") as HTMLElement,
    container,
  };
}

describe("TopicViewRenderer — sidebar tree DOM nesting", () => {
  it("renders a leaf node with no children container", () => {
    const { sidebar } = render([makeNode("Technology")], []);
    const itemEl = sidebar.querySelector(".pm-ref-tree__item");
    expect(itemEl).not.toBeNull();
    expect(itemEl!.querySelector(".pm-ref-tree__children")).toBeNull();
  });

  it("places the children container as a sibling of the label row", () => {
    const { sidebar } = render([makeNode("Technology", [makeNode("Kubernetes")])], []);
    const itemEl = sidebar.querySelector(".pm-ref-tree__item")!;
    const labelRowEl = itemEl.querySelector(".pm-ref-tree__node")!;
    const childrenEl = itemEl.querySelector(".pm-ref-tree__children")!;
    expect(childrenEl).not.toBeNull();
    expect(labelRowEl.querySelector(".pm-ref-tree__children")).toBeNull();
    const directChildrenOfSidebar = [...sidebar.children].filter((el) =>
      el.classList.contains("pm-ref-tree__children")
    );
    expect(directChildrenOfSidebar).toHaveLength(0);
  });

  it("nests three levels deep correctly", () => {
    const { sidebar } = render(
      [makeNode("Technology", [makeNode("Kubernetes", [makeNode("Helm")])])],
      []
    );
    const l1 = sidebar.querySelector(".pm-ref-tree__item")!;
    const l1Children = l1.querySelector(".pm-ref-tree__children")!;
    const l2 = l1Children.querySelector(".pm-ref-tree__item")!;
    const l2Children = l2.querySelector(".pm-ref-tree__children")!;
    const l3 = l2Children.querySelector(".pm-ref-tree__item")!;
    expect(l3.textContent).toContain("Helm");
  });

  it("renders multiple root nodes at the top level", () => {
    const { sidebar } = render([makeNode("Technology"), makeNode("Architecture")], []);
    const topLevel = [...sidebar.children].filter((el) => el.classList.contains("pm-ref-tree__item"));
    expect(topLevel).toHaveLength(2);
  });

  it("marks the selected node with the selected CSS class", () => {
    const { sidebar } = render([makeNode("Technology", [makeNode("Kubernetes")])], [], "Technology");
    const selected = sidebar.querySelectorAll(".pm-ref-tree__node--selected");
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain("Technology");
  });

  it("renders expand/collapse toggle only for nodes with children", () => {
    const { sidebar } = render([makeNode("Technology", [makeNode("Kubernetes")]), makeNode("Other")], []);
    const nodes = sidebar.querySelectorAll(".pm-ref-tree__node");
    expect(nodes[0].querySelector(".pm-ref-tree__toggle")?.textContent).toBe("▾");
    expect(nodes[1].querySelector(".pm-ref-tree__toggle")?.textContent).toBe(" ");
  });

  it("the label row contains only the toggle and name", () => {
    const { sidebar } = render([makeNode("Technology", [makeNode("Kubernetes")])], []);
    const labelRowEl = sidebar.querySelector(".pm-ref-tree__node")!;
    expect(labelRowEl.querySelector(".pm-ref-tree__children")).toBeNull();
    expect(labelRowEl.children).toHaveLength(2);
  });

  it("shows a 'No topics.' empty state when the tree is empty", () => {
    const { sidebar } = render([], []);
    const empty = sidebar.querySelector(".pm-ref-empty");
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toBe("No topics.");
  });

  it("emits a selectedNode patch on node click", () => {
    const onFilterChange = vi.fn();
    const { sidebar } = render([makeNode("Technology")], [], undefined, onFilterChange);
    (sidebar.querySelector(".pm-ref-tree__node") as HTMLElement).click();
    expect(onFilterChange).toHaveBeenCalledWith({ selectedNode: "Technology" });
  });

  it("emits an undefined selectedNode patch when clicking the already-selected node", () => {
    const onFilterChange = vi.fn();
    const { sidebar } = render([makeNode("Technology")], [], "Technology", onFilterChange);
    (sidebar.querySelector(".pm-ref-tree__node") as HTMLElement).click();
    expect(onFilterChange).toHaveBeenCalledWith({ selectedNode: undefined });
  });
});

describe("TopicViewRenderer — content panel (hierarchical) view", () => {
  it("renders nested groups for root topics when no node is selected", () => {
    const tree = [makeNode("Technology", [makeNode("Kubernetes")])];
    const refs = [makeRef("Book A", { topics: ["Technology"] }), makeRef("Book B", { topics: ["Kubernetes"] })];
    const { panel } = render(tree, refs);
    const titles = [...panel.querySelectorAll(".pm-ref-group__title")].map((el) => el.textContent);
    expect(titles).toContain("Technology");
    expect(titles).toContain("Kubernetes");
  });

  it("nests a child group inside its parent, not at the top level", () => {
    const tree = [makeNode("Technology", [makeNode("Kubernetes")])];
    const refs = [makeRef("Book A", { topics: ["Technology"] }), makeRef("Book B", { topics: ["Kubernetes"] })];
    const { panel } = render(tree, refs);
    const topLevel = [...panel.children].filter((el) => el.classList.contains("pm-ref-group"));
    expect(topLevel).toHaveLength(1);
    expect(topLevel[0].querySelector(".pm-ref-group__title")?.textContent).toBe("Technology");
  });

  it("falls back to flat groups when the topic tree is empty", () => {
    const refs = [makeRef("Book A", { topics: ["Architecture"] }), makeRef("Book B", { topics: ["Testing"] })];
    const { panel } = render([], refs);
    const titles = [...panel.querySelectorAll(".pm-ref-group__title")].map((el) => el.textContent);
    expect(titles).toContain("Architecture");
    expect(titles).toContain("Testing");
  });

  it("shows an empty state when no references exist", () => {
    const { panel } = render([makeNode("Technology")], []);
    expect(panel.querySelector(".pm-ref-empty")).not.toBeNull();
  });

  it("scopes the content to the selected node's subtree", () => {
    const tree = [makeNode("Technology", [makeNode("Kubernetes")]), makeNode("Architecture")];
    const refs = [
      makeRef("Book A", { topics: ["Technology"] }),
      makeRef("Book B", { topics: ["Kubernetes"] }),
      makeRef("Book C", { topics: ["Architecture"] }),
    ];
    const { panel } = render(tree, refs, "Technology");
    expect(panel.textContent).not.toContain("Book C");
    expect(panel.textContent).toContain("Book A");
    expect(panel.textContent).toContain("Book B");
  });

  it("renders an 'Other' group for references whose topic is not in the tree", () => {
    const tree = [makeNode("Technology")];
    const refs = [makeRef("Orphan", { topics: ["Ghost"] })];
    const { panel } = render(tree, refs);
    const titles = [...panel.querySelectorAll(".pm-ref-group__title")].map((el) => el.textContent);
    expect(titles).toContain("Other");
  });
});

describe("TopicViewRenderer — data-depth attributes", () => {
  it("root tree nodes have data-depth='0'", () => {
    const { sidebar } = render([makeNode("Technology"), makeNode("Architecture")], []);
    const items = [...sidebar.querySelectorAll<HTMLElement>(":scope > .pm-ref-tree__item")];
    expect(items.length).toBe(2);
    for (const item of items) expect(item.getAttribute("data-depth")).toBe("0");
  });

  it("child tree nodes have data-depth='1'", () => {
    const { sidebar } = render([makeNode("Technology", [makeNode("Kubernetes")])], []);
    const childItem = sidebar
      .querySelector(".pm-ref-tree__children")!
      .querySelector<HTMLElement>(".pm-ref-tree__item");
    expect(childItem!.getAttribute("data-depth")).toBe("1");
  });

  it("root content groups have data-depth='0'", () => {
    const { panel } = render([makeNode("Technology")], [makeRef("Book A", { topics: ["Technology"] })]);
    const rootGroup = panel.querySelector<HTMLElement>(":scope > .pm-ref-group");
    expect(rootGroup!.getAttribute("data-depth")).toBe("0");
  });

  it("nested content groups have data-depth='1'", () => {
    const tree = [makeNode("Technology", [makeNode("Kubernetes")])];
    const { panel } = render(tree, [makeRef("Book A", { topics: ["Kubernetes"] })]);
    const nested = panel
      .querySelector(".pm-ref-group__body")!
      .querySelector<HTMLElement>(":scope > .pm-ref-group");
    expect(nested!.getAttribute("data-depth")).toBe("1");
  });
});

describe("TopicViewRenderer — sidebar toggle click", () => {
  it("toggles children visibility on successive toggle clicks", () => {
    const { sidebar } = render([makeNode("Technology", [makeNode("Kubernetes")])], []);
    const toggleEl = sidebar.querySelector(".pm-ref-tree__toggle") as HTMLElement;
    const childrenEl = sidebar.querySelector(".pm-ref-tree__children") as HTMLElement;
    expect(childrenEl.style.display).toBe("block");
    expect(toggleEl.textContent).toBe("▾");
    toggleEl.click();
    expect(childrenEl.style.display).toBe("none");
    expect(toggleEl.textContent).toBe("▶");
    toggleEl.click();
    expect(childrenEl.style.display).toBe("block");
    expect(toggleEl.textContent).toBe("▾");
  });

  it("does not toggle when clicking the label row", () => {
    const { sidebar } = render([makeNode("Technology", [makeNode("Kubernetes")])], []);
    const childrenEl = sidebar.querySelector(".pm-ref-tree__children") as HTMLElement;
    const nodeEl = sidebar.querySelector(".pm-ref-tree__node") as HTMLElement;
    expect(childrenEl.style.display).toBe("block");
    nodeEl.click();
    expect(childrenEl.style.display).toBe("block");
  });
});
