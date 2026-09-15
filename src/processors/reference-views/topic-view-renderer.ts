import type { DataviewPage, TopicNode, ReferenceFilters } from "../../types";
import { normalizeToName } from "../../utils/link-utils";
import { CSS_CLS, DOM_ATTR, DOM_EVENT, HTML_TAG, FM_KEY, REFERENCE_VIEW_MODE, REFERENCES_DASHBOARD_TEXT } from "../../constants";
import type { IViewRenderer, ViewRenderContext } from "../view-renderer";
import {
  renderCollapsibleGroup,
  renderReferenceCard,
  renderEmptyState,
} from "./reference-card-renderer";
import type { CardNavigationServices, RefRenderHelpers } from "./reference-card-renderer";

/**
 * The References "By Topic" view: a sidebar tree plus a content panel of nested
 * collapsible groups mirroring the topic hierarchy. It reads the topic tree from
 * `ctx.helpers` (no self-query), renders the (already filtered) `ctx.items`
 * scoped to the selected subtree, and emits `selectedNode` patches on node click.
 */
export class TopicViewRenderer
  implements IViewRenderer<DataviewPage, RefRenderHelpers, ReferenceFilters>
{
  readonly mode = REFERENCE_VIEW_MODE.TOPIC;

  render(ctx: ViewRenderContext<DataviewPage, RefRenderHelpers, ReferenceFilters>): void {
    const sidebar = ctx.container.createDiv({ cls: CSS_CLS.REFERENCES_SIDEBAR });
    const panel = ctx.container.createDiv({ cls: CSS_CLS.REFERENCES_PANEL });

    const tree = ctx.helpers.topicTree;
    const cardServices = ctx.helpers.cardServices;
    const selectedNode = ctx.filters.selectedNode
      ? (normalizeToName(ctx.filters.selectedNode) ?? undefined)
      : undefined;
    const onNodeSelect = (node: string | undefined): void => ctx.onFilterChange({ selectedNode: node });

    renderTopicSidebar(sidebar, tree, selectedNode, onNodeSelect);

    if (selectedNode) {
      const rootNode = findNodeInTree(tree, selectedNode);
      const descendants = rootNode ? collectDescendantNames(rootNode) : [];
      const scope = new Set([selectedNode, ...descendants]);
      const scoped = ctx.items.filter((ref) => {
        const topics = topicNamesOf(ref);
        return topics.some((name) => scope.has(name));
      });
      renderScopedTopicContent(panel, scoped, selectedNode, tree, cardServices);
    } else {
      renderHierarchicalTopicContent(panel, ctx.items, tree, cardServices);
    }
  }
}

// ─── Frontmatter helpers ─────────────────────────────────────────────────────

/** The reference's raw `topics` frontmatter as an array (single value ⇒ singleton). */
function rawTopics(ref: DataviewPage): unknown[] {
  const topics = ref[FM_KEY.TOPICS];
  return Array.isArray(topics) ? topics : topics ? [topics] : [];
}

/** The reference's normalized topic display names (drops entries that fail to resolve). */
function topicNamesOf(ref: DataviewPage): string[] {
  return rawTopics(ref)
    .map((t) => normalizeToName(t))
    .filter((name): name is string => name !== null);
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
    sidebar.createEl(HTML_TAG.P, { cls: CSS_CLS.REF_EMPTY, text: REFERENCES_DASHBOARD_TEXT.NO_TOPICS });
    return;
  }
  for (const node of tree) {
    renderTreeNode(sidebar, node, selectedNode, onNodeSelect, 0);
  }
}

function renderTreeNode(
  container: HTMLElement,
  node: TopicNode,
  selectedNode: string | undefined,
  onNodeSelect: (node: string | undefined) => void,
  depth = 0
): void {
  const isSelected = selectedNode === node.name;
  const hasChildren = node.children.length > 0;

  // Block-level wrapper that holds the label row and (optionally) the children container
  const itemEl = container.createDiv({ cls: CSS_CLS.REF_TREE_ITEM });
  itemEl.setAttribute(DOM_ATTR.DATA_DEPTH, String(depth));

  // Label row (flex) — contains only the toggle span and name span
  const nodeEl = itemEl.createDiv({
    cls: isSelected ? `${CSS_CLS.REF_TREE_NODE} ${CSS_CLS.REF_TREE_NODE_SELECTED}` : CSS_CLS.REF_TREE_NODE,
  });

  // Toggle icon
  const toggleEl = nodeEl.createSpan({ cls: CSS_CLS.REF_TREE_TOGGLE });
  if (hasChildren) {
    toggleEl.setText(REFERENCES_DASHBOARD_TEXT.TOGGLE_EXPANDED); // start expanded
  } else {
    toggleEl.setText(REFERENCES_DASHBOARD_TEXT.TOGGLE_LEAF);
  }

  nodeEl.createSpan({ text: node.name });

  nodeEl.addEventListener(DOM_EVENT.CLICK, (e) => {
    e.stopPropagation();
    onNodeSelect(isSelected ? undefined : node.name);
  });

  if (hasChildren) {
    // Children container is a sibling of the label row inside the item wrapper, NOT inside the flex label row
    const childrenEl = itemEl.createDiv({ cls: CSS_CLS.REF_TREE_CHILDREN });
    childrenEl.style.display = "block";

    toggleEl.addEventListener(DOM_EVENT.CLICK, (e) => {
      e.stopPropagation();
      const isExpanded = childrenEl.style.display !== "none";
      childrenEl.style.display = isExpanded ? "none" : "block";
      toggleEl.setText(isExpanded ? REFERENCES_DASHBOARD_TEXT.TOGGLE_COLLAPSED : REFERENCES_DASHBOARD_TEXT.TOGGLE_EXPANDED);
    });

    for (const child of node.children) {
      renderTreeNode(childrenEl, child, selectedNode, onNodeSelect, depth + 1);
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
  tree: TopicNode[],
  cardServices: CardNavigationServices
): void {
  if (references.length === 0) {
    renderEmptyState(panel, REFERENCES_DASHBOARD_TEXT.NO_REFERENCES);
    return;
  }

  if (tree.length === 0) {
    // No topic tree — fall back to flat alphabetical groups
    renderFlatTopicContent(panel, references, cardServices);
    return;
  }

  // Render each root node as a nested group
  for (const rootNode of tree) {
    renderNestedGroup(panel, rootNode, references, 0, cardServices);
  }

  // Render any references whose topics are not in the tree (orphans)
  const treeNames = new Set<string>();
  const collectTreeNames = (node: TopicNode) => {
    treeNames.add(node.name);
    node.children.forEach(collectTreeNames);
  };
  tree.forEach(collectTreeNames);

  const orphanRefs = references.filter((ref) => {
    const topics = topicNamesOf(ref);
    return topics.length === 0 || topics.every((name) => !treeNames.has(name));
  });

  if (orphanRefs.length > 0) {
    const groupBody = renderCollapsibleGroup(panel, REFERENCES_DASHBOARD_TEXT.OTHER, orphanRefs.length);
    for (const ref of orphanRefs) renderReferenceCard(groupBody, ref, cardServices);
  }
}

/**
 * Flat alphabetical fallback — used when the topic tree is empty.
 */
function renderFlatTopicContent(
  panel: HTMLElement,
  references: DataviewPage[],
  cardServices: CardNavigationServices
): void {
  const groups = new Map<string, DataviewPage[]>();
  for (const ref of references) {
    for (const name of topicNamesOf(ref)) {
      let bucket = groups.get(name);
      if (!bucket) { bucket = []; groups.set(name, bucket); }
      bucket.push(ref);
    }
  }

  const sortedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  if (sortedGroups.length === 0) {
    renderEmptyState(panel, REFERENCES_DASHBOARD_TEXT.NO_REFERENCES);
    return;
  }

  for (const [topicName, refs] of sortedGroups) {
    const groupBody = renderCollapsibleGroup(panel, topicName, refs.length);
    for (const ref of refs) {
      const raw = rawTopics(ref);
      const primaryTopic = raw.length > 0 ? (normalizeToName(raw[0]) ?? "") : "";
      const isSecondary = primaryTopic !== topicName && primaryTopic !== "";
      renderReferenceCard(groupBody, ref, cardServices, isSecondary ? REFERENCES_DASHBOARD_TEXT.alsoIn(primaryTopic) : undefined);
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
  tree: TopicNode[],
  cardServices: CardNavigationServices
): void {
  if (references.length === 0) {
    renderEmptyState(panel, REFERENCES_DASHBOARD_TEXT.NO_REFERENCES);
    return;
  }

  const rootNode = findNodeInTree(tree, selectedNode);
  if (!rootNode) {
    // Fallback: show as flat group
    const groupBody = renderCollapsibleGroup(panel, selectedNode, references.length);
    for (const ref of references) renderReferenceCard(groupBody, ref, cardServices);
    return;
  }

  renderNestedGroup(panel, rootNode, references, 0, cardServices);
}

function renderNestedGroup(
  container: HTMLElement,
  node: TopicNode,
  allReferences: DataviewPage[],
  depth = 0,
  cardServices: CardNavigationServices
): void {
  // Direct references for this node only
  const directRefs = allReferences.filter((ref) => topicNamesOf(ref).includes(node.name));

  // Total count = direct + all in subtree
  const subtreeNames = new Set([node.name]);
  const collectNames = (n: TopicNode) => {
    subtreeNames.add(n.name);
    n.children.forEach(collectNames);
  };
  node.children.forEach(collectNames);
  const totalRefs = allReferences.filter((ref) =>
    topicNamesOf(ref).some((name) => subtreeNames.has(name))
  );

  const groupBody = renderCollapsibleGroup(container, node.name, totalRefs.length);
  groupBody.parentElement?.setAttribute(DOM_ATTR.DATA_DEPTH, String(depth));

  // Direct references first
  for (const ref of directRefs) renderReferenceCard(groupBody, ref, cardServices);

  // Then nested child groups
  for (const child of node.children) {
    renderNestedGroup(groupBody, child, allReferences, depth + 1, cardServices);
  }
}
