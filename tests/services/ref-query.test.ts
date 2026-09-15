import { describe, it, expect } from "vitest";
import { RefQuery } from "@/services/ref-query";
import { createMockDataviewApi } from "../mocks/dataview-mock";
import type { MockPageData } from "../mocks/dataview-mock";
import type { DataviewApi } from "@/types";

function refQuery(dv: DataviewApi | null): RefQuery {
  return new RefQuery(() => dv);
}

function makeTopicPage(name: string, parent?: string): MockPageData {
  return {
    path: `reference/reference-topics/${name}.md`,
    name,
    tags: ["#reference-topic"],
    frontmatter: parent ? { parent: `[[${parent}]]` } : {},
  };
}

// ─── resolve() ─────────────────────────────────────────────────────────────

describe("RefQuery — resolve", () => {
  it("returns no items when Dataview is unavailable", () => {
    expect(refQuery(null).resolve()).toEqual([]);
  });

  it("returns every #reference page and no non-reference pages", () => {
    const dv = createMockDataviewApi([
      { path: "reference/references/Ref1.md", tags: ["#reference"], frontmatter: { topics: ["[[Architecture]]"] } },
      { path: "reference/references/Ref2.md", tags: ["#reference"], frontmatter: { topics: ["[[Security]]"] } },
      { path: "projects/P.md", tags: ["#project"], frontmatter: {} },
    ]);
    const names = refQuery(dv).resolve().map((p) => p.file.name);
    expect(names).toHaveLength(2);
    expect(names).toEqual(expect.arrayContaining(["Ref1", "Ref2"]));
  });
});

// ─── getReferenceTopicTree() ─────────────────────────────────────────────────

describe("RefQuery — getReferenceTopicTree", () => {
  it("returns [] when dv() is null", () => {
    expect(refQuery(null).getReferenceTopicTree()).toEqual([]);
  });

  it("returns all topics as root nodes when none have a parent field", () => {
    const dv = createMockDataviewApi([
      makeTopicPage("Architecture"),
      makeTopicPage("Security"),
      makeTopicPage("Design"),
    ]);
    const tree = refQuery(dv).getReferenceTopicTree();
    expect(tree).toHaveLength(3);
    expect(tree.map((n) => n.name)).toEqual(
      expect.arrayContaining(["Architecture", "Design", "Security"])
    );
    tree.forEach((n) => expect(n.children).toHaveLength(0));
  });

  it("correctly nests a child under its parent", () => {
    const dv = createMockDataviewApi([makeTopicPage("Cloud"), makeTopicPage("Kubernetes", "Cloud")]);
    const tree = refQuery(dv).getReferenceTopicTree();
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("Cloud");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].name).toBe("Kubernetes");
  });

  it("sorts children alphabetically at each level", () => {
    const dv = createMockDataviewApi([
      makeTopicPage("Cloud"),
      makeTopicPage("Zookeeper", "Cloud"),
      makeTopicPage("ArgoCD", "Cloud"),
      makeTopicPage("Kubernetes", "Cloud"),
    ]);
    const tree = refQuery(dv).getReferenceTopicTree();
    expect(tree[0].children.map((n) => n.name)).toEqual(["ArgoCD", "Kubernetes", "Zookeeper"]);
  });

  it("treats a topic with an unresolvable parent as a root node", () => {
    const dv = createMockDataviewApi([makeTopicPage("Kubernetes", "NonExistentParent")]);
    const tree = refQuery(dv).getReferenceTopicTree();
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("Kubernetes");
    expect(tree[0].children).toHaveLength(0);
  });

  it("guards against circular references (A → B → A — both are treated as roots)", () => {
    const dv = createMockDataviewApi([
      makeTopicPage("TopicA", "TopicB"),
      makeTopicPage("TopicB", "TopicA"),
    ]);
    const tree = refQuery(dv).getReferenceTopicTree();
    expect(tree).toHaveLength(2);
    expect(tree.map((n) => n.name)).toEqual(expect.arrayContaining(["TopicA", "TopicB"]));
    tree.forEach((n) => expect(n.children).toHaveLength(0));
  });

  it("handles multi-level nesting (A → B → C)", () => {
    const dv = createMockDataviewApi([
      makeTopicPage("Cloud"),
      makeTopicPage("Kubernetes", "Cloud"),
      makeTopicPage("Helm", "Kubernetes"),
    ]);
    const tree = refQuery(dv).getReferenceTopicTree();
    expect(tree).toHaveLength(1);
    const cloud = tree[0];
    expect(cloud.children).toHaveLength(1);
    const k8s = cloud.children[0];
    expect(k8s.name).toBe("Kubernetes");
    expect(k8s.children[0].name).toBe("Helm");
  });

  it("regression #72: case-insensitive parent name matching", () => {
    const dv = createMockDataviewApi([
      makeTopicPage("Kubernetes"),
      {
        path: "reference/reference-topics/kubectl.md",
        name: "kubectl",
        tags: ["#reference-topic"],
        frontmatter: { parent: "[[kubernetes]]" },
      },
    ]);
    const tree = refQuery(dv).getReferenceTopicTree();
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("Kubernetes");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].name).toBe("kubectl");
  });
});

// ─── getTopicDescendants() ───────────────────────────────────────────────────

describe("RefQuery — getTopicDescendants", () => {
  it("returns [] when dv() is null", () => {
    expect(refQuery(null).getTopicDescendants("Cloud")).toEqual([]);
  });

  it("returns [] for a leaf node", () => {
    const dv = createMockDataviewApi([makeTopicPage("Cloud"), makeTopicPage("Kubernetes", "Cloud")]);
    expect(refQuery(dv).getTopicDescendants("Kubernetes")).toEqual([]);
  });

  it("returns direct children", () => {
    const dv = createMockDataviewApi([
      makeTopicPage("Cloud"),
      makeTopicPage("Kubernetes", "Cloud"),
      makeTopicPage("Terraform", "Cloud"),
    ]);
    const descendants = refQuery(dv).getTopicDescendants("Cloud");
    expect(descendants).toHaveLength(2);
    expect(descendants).toEqual(expect.arrayContaining(["Kubernetes", "Terraform"]));
  });

  it("returns all descendants at all depths (multi-level)", () => {
    const dv = createMockDataviewApi([
      makeTopicPage("Cloud"),
      makeTopicPage("Kubernetes", "Cloud"),
      makeTopicPage("Helm", "Kubernetes"),
      makeTopicPage("HelmCharts", "Helm"),
    ]);
    const descendants = refQuery(dv).getTopicDescendants("Cloud");
    expect(descendants).toHaveLength(3);
    expect(descendants).toEqual(expect.arrayContaining(["Kubernetes", "Helm", "HelmCharts"]));
  });

  it("does not include the root node itself, only descendants", () => {
    const dv = createMockDataviewApi([makeTopicPage("Cloud"), makeTopicPage("Kubernetes", "Cloud")]);
    expect(refQuery(dv).getTopicDescendants("Cloud")).not.toContain("Cloud");
  });

  it("returns [] for a topic name not in the tree", () => {
    const dv = createMockDataviewApi([makeTopicPage("Cloud"), makeTopicPage("Kubernetes", "Cloud")]);
    expect(refQuery(dv).getTopicDescendants("NonExistentTopic")).toEqual([]);
  });
});
