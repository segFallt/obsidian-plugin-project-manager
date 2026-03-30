import type { DataviewPage, TopicNode } from "../../types";
import type { ReferenceProcessorServices } from "../../plugin-context";
import { normalizeToName } from "../../utils/link-utils";
import { CSS_CLS, CSS_VAR } from "../../constants";

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Renders the topic sidebar (tree) and content panel (nested collapsible groups).
 */
export function renderTopicView(
  sidebar: HTMLElement,
  panel: HTMLElement,
  references: DataviewPage[],
  services: ReferenceProcessorServices,
  selectedNode: string | undefined,
  onNodeSelect: (node: string | undefined) => void
): void {
  const tree = services.queryService.getReferenceTopicTree();

  // Render sidebar tree
  renderTopicSidebar(sidebar, tree, selectedNode, onNodeSelect);

  // Render content panel
  if (selectedNode) {
    const rootNode = findNodeInTree(tree, selectedNode);
    const descendants = rootNode ? collectDescendantNames(rootNode) : [];
    const scope = new Set([selectedNode, ...descendants]);
    const scoped = references.filter((ref) => {
      const topics = Array.isArray(ref.topics) ? ref.topics : ref.topics ? [ref.topics] : [];
      return topics.some((t) => {
        const name = normalizeToName(t);
        return name ? scope.has(name) : false;
      });
    });
    renderScopedTopicContent(panel, scoped, selectedNode, tree);
  } else {
    renderHierarchicalTopicContent(panel, references, tree);
  }
}

// ─── Tree traversal helpers ──────────────────────────────────────────────────

function findNodeInTree(nodes: TopicNode[], name: string): TopicNode | null {
  for (const n of nodes) {
    if (n.name === name) return n;
    const found = findNodeInTree(n.children, name);
    if (found) return found;
  }
  return null;
}

function collectDescendantNames(node: TopicNode): string[] {
  const result: string[] = [];
  const stack = [...node.children];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const n = stack.pop();
    if (!n) break;
    if (visited.has(n.name)) continue;
    visited.add(n.name);
    result.push(n.name);
    stack.push(...n.children);
  }
  return result;
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function renderTopicSidebar(
  sidebar: HTMLElement,
  tree: TopicNode[],
  selectedNode: string | undefined,
  onNodeSelect: (node: string | undefined) => void
): void {
  if (tree.length === 0) {
    sidebar.createEl("p", { cls: "pm-ref-empty", text: "No topics." });
    return;
  }
  for (const node of tree) {
    renderTreeNode(sidebar, node, selectedNode, onNodeSelect);
  }
}

function renderTreeNode(
  container: HTMLElement,
  node: TopicNode,
  selectedNode: string | undefined,
  onNodeSelect: (node: string | undefined) => void
): void {
  const isSelected = selectedNode === node.name;
  const hasChildren = node.children.length > 0;

  // Block-level wrapper that holds the label row and (optionally) the children container
  const itemEl = container.createDiv({ cls: "pm-ref-tree__item" });

  // Label row (flex) — contains only the toggle span and name span
  const nodeEl = itemEl.createDiv({
    cls: `pm-ref-tree__node${isSelected ? " pm-ref-tree__node--selected" : ""}`,
  });

  // Toggle icon
  const toggleEl = nodeEl.createSpan({ cls: "pm-ref-tree__toggle" });
  if (hasChildren) {
    toggleEl.setText("▾"); // start expanded
  } else {
    toggleEl.setText(" ");
  }

  nodeEl.createSpan({ text: node.name });

  nodeEl.addEventListener("click", (e) => {
    e.stopPropagation();
    onNodeSelect(isSelected ? undefined : node.name);
  });

  if (hasChildren) {
    // Children container is a sibling of the label row inside the item wrapper, NOT inside the flex label row
    const childrenEl = itemEl.createDiv({ cls: "pm-ref-tree__children" });
    childrenEl.style.display = "block";

    toggleEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const isExpanded = childrenEl.style.display !== "none";
      childrenEl.style.display = isExpanded ? "none" : "block";
      toggleEl.setText(isExpanded ? "▶" : "▾");
    });

    for (const child of node.children) {
      renderTreeNode(childrenEl, child, selectedNode, onNodeSelect);
    }
  }
}

// ─── Content panel ────────────────────────────────────────────────────────────

/**
 * When no node is selected: nested groups mirroring the topic tree.
 * Root topics are rendered as top-level collapsible groups with child topics nested inside.
 * Topics not present in the tree fall back to a flat alphabetical group at the end.
 */
function renderHierarchicalTopicContent(
  panel: HTMLElement,
  references: DataviewPage[],
  tree: TopicNode[]
): void {
  if (references.length === 0) {
    renderEmptyState(panel, "No references found.");
    return;
  }

  if (tree.length === 0) {
    // No topic tree — fall back to flat alphabetical groups
    renderFlatTopicContent(panel, references);
    return;
  }

  // Render each root node as a nested group
  for (const rootNode of tree) {
    renderNestedGroup(panel, rootNode, references);
  }

  // Render any references whose topics are not in the tree (orphans)
  const treeNames = new Set<string>();
  const collectTreeNames = (node: TopicNode) => {
    treeNames.add(node.name);
    node.children.forEach(collectTreeNames);
  };
  tree.forEach(collectTreeNames);

  const orphanRefs = references.filter((ref) => {
    const topics = Array.isArray(ref.topics) ? ref.topics : ref.topics ? [ref.topics] : [];
    return topics.length === 0 || topics.every((t) => {
      const name = normalizeToName(t);
      return !name || !treeNames.has(name);
    });
  });

  if (orphanRefs.length > 0) {
    const groupBody = renderCollapsibleGroup(panel, "Other", orphanRefs.length);
    for (const ref of orphanRefs) renderReferenceCard(groupBody, ref);
  }
}

/**
 * Flat alphabetical fallback — used when the topic tree is empty.
 */
function renderFlatTopicContent(
  panel: HTMLElement,
  references: DataviewPage[]
): void {
  const groups = new Map<string, DataviewPage[]>();
  for (const ref of references) {
    const topics = Array.isArray(ref.topics) ? ref.topics : ref.topics ? [ref.topics] : [];
    for (const t of topics) {
      const name = normalizeToName(t) ?? "";
      if (!name) continue;
      let bucket = groups.get(name);
      if (!bucket) { bucket = []; groups.set(name, bucket); }
      bucket.push(ref);
    }
  }

  const sortedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  if (sortedGroups.length === 0) {
    renderEmptyState(panel, "No references found.");
    return;
  }

  for (const [topicName, refs] of sortedGroups) {
    const groupBody = renderCollapsibleGroup(panel, topicName, refs.length);
    for (const ref of refs) {
      const primaryTopic =
        Array.isArray(ref.topics) && ref.topics.length > 0
          ? (normalizeToName(ref.topics[0]) ?? "")
          : ref.topics ? (normalizeToName(ref.topics) ?? "") : "";
      const isSecondary = primaryTopic !== topicName && primaryTopic !== "";
      renderReferenceCard(groupBody, ref, isSecondary ? `also in ${primaryTopic}` : undefined);
    }
  }
}

/**
 * When a node is selected: nested collapsible groups scoped to the selected subtree.
 * Leaf node → single flat group.
 * Parent node → nested groups.
 */
function renderScopedTopicContent(
  panel: HTMLElement,
  references: DataviewPage[],
  selectedNode: string,
  tree: TopicNode[]
): void {
  if (references.length === 0) {
    renderEmptyState(panel, "No references found.");
    return;
  }

  const rootNode = findNodeInTree(tree, selectedNode);
  if (!rootNode) {
    // Fallback: show as flat group
    const groupBody = renderCollapsibleGroup(panel, selectedNode, references.length);
    for (const ref of references) renderReferenceCard(groupBody, ref);
    return;
  }

  renderNestedGroup(panel, rootNode, references);
}

function renderNestedGroup(
  container: HTMLElement,
  node: TopicNode,
  allReferences: DataviewPage[]
): void {
  // Direct references for this node only
  const directRefs = allReferences.filter((ref) => {
    const topics = Array.isArray(ref.topics) ? ref.topics : ref.topics ? [ref.topics] : [];
    return topics.some((t) => normalizeToName(t) === node.name);
  });

  // Total count = direct + all in subtree
  const subtreeNames = new Set([node.name]);
  const collectNames = (n: TopicNode) => {
    subtreeNames.add(n.name);
    n.children.forEach(collectNames);
  };
  node.children.forEach(collectNames);
  const totalRefs = allReferences.filter((ref) => {
    const topics = Array.isArray(ref.topics) ? ref.topics : ref.topics ? [ref.topics] : [];
    return topics.some((t) => {
      const name = normalizeToName(t);
      return name ? subtreeNames.has(name) : false;
    });
  });

  const groupBody = renderCollapsibleGroup(container, node.name, totalRefs.length);

  // Direct references first
  for (const ref of directRefs) renderReferenceCard(groupBody, ref);

  // Then nested child groups
  for (const child of node.children) {
    renderNestedGroup(groupBody, child, allReferences);
  }
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Renders a collapsible group header (title + count badge + arrow).
 * Returns the body element for card insertion.
 */
export function renderCollapsibleGroup(
  container: HTMLElement,
  title: string,
  count: number
): HTMLElement {
  const details = container.createEl("details", { cls: "pm-ref-group" });
  details.setAttribute("open", "");

  const summary = details.createEl("summary", { cls: "pm-ref-group__header" });
  summary.createSpan({ cls: "pm-ref-group__title", text: title });
  summary.createSpan({ cls: "pm-ref-group__count", text: String(count) });

  const body = details.createDiv({ cls: "pm-ref-group__body" });
  return body;
}

/**
 * Renders a single reference card with title link, context chips, and optional hint tag.
 */
export function renderReferenceCard(
  container: HTMLElement,
  ref: DataviewPage,
  hint?: string
): void {
  const card = container.createDiv({ cls: "pm-ref-card" });

  // Title row: document icon + internal link
  const titleRow = card.createDiv({ cls: "pm-ref-card__title-row" });
  titleRow.createSpan({ cls: "pm-ref-card__icon", text: "📄" });
  const link = titleRow.createEl("a", {
    cls: CSS_CLS.INTERNAL_LINK,
    text: ref.file.name,
  });
  link.setAttribute("data-href", ref.file.path);
  link.setAttribute("href", ref.file.path);

  if (hint) {
    titleRow.createSpan({ cls: "pm-ref-card__hint", text: hint });
  }

  // Context chips row
  const chipsRow = card.createDiv({ cls: "pm-ref-card__chips" });

  // Topic chips
  const topics = Array.isArray(ref.topics) ? ref.topics : ref.topics ? [ref.topics] : [];
  for (const t of topics) {
    const name = normalizeToName(t);
    if (name) {
      chipsRow.createSpan({ cls: "pm-ref-chip pm-ref-chip--topic", text: name });
    }
  }

  // Client chip
  const clientName = normalizeToName(ref.client);
  if (clientName) {
    chipsRow.createSpan({ cls: "pm-ref-chip pm-ref-chip--client", text: clientName });
  }

  // Engagement chip
  const engagementName = normalizeToName(ref.engagement);
  if (engagementName) {
    chipsRow.createSpan({ cls: "pm-ref-chip pm-ref-chip--engagement", text: engagementName });
  }
}

/**
 * Renders a muted "empty state" message when no references match.
 */
export function renderEmptyState(container: HTMLElement, message: string): void {
  const el = container.createEl("p", { cls: "pm-ref-empty", text: message });
  el.style.color = CSS_VAR.TEXT_MUTED;
  el.style.fontStyle = "italic";
}
