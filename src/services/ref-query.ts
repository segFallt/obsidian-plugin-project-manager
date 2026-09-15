import type { DataviewApi, DataviewPage, TopicNode } from "../types";
import { ENTITY_TAGS, FM_KEY } from "../constants";
import { normalizeToName } from "../utils/link-utils";
import type { IEntityQuery } from "./entity-query";

/**
 * Reads every `#reference` page for the References dashboard — the base read the
 * dashboard filters and groups. Wraps the Dataview page scan behind
 * {@link IEntityQuery} so the shell injects it uniformly; returns an empty
 * result when Dataview is unavailable.
 *
 * This is a pure base read: narrowing by topic, client, engagement, or search is
 * the reference `FilterSpec`'s job (its captured predicates), not the query's.
 * It also owns the reference-topic tree derivation the topic view renders from.
 */
export class RefQuery implements IEntityQuery<DataviewPage> {
  constructor(private readonly getDv: () => DataviewApi | null) {}

  resolve(): DataviewPage[] {
    const dv = this.getDv();
    if (!dv) return [];
    return [...dv.pages(ENTITY_TAGS.reference)];
  }

  /**
   * Builds the full Reference Topic tree from all #reference-topic pages.
   * Root nodes: topics with no parent field, or whose parent cannot be resolved.
   * Children are sorted alphabetically at each level.
   * Guards against circular parent references — topics in a cycle are treated as roots.
   */
  getReferenceTopicTree(): TopicNode[] {
    const dv = this.getDv();
    if (!dv) return [];

    const pages = [...dv.pages(ENTITY_TAGS.referenceTopic)] as DataviewPage[];
    const pageMap = new Map<string, DataviewPage>();
    for (const p of pages) {
      pageMap.set(p.file.name, p);
    }

    // Case-insensitive fallback: maps lowercase name → canonical name in pageMap.
    // Obsidian filenames are unique on case-insensitive filesystems; last-write wins is acceptable here.
    const pageMapLower = new Map<string, string>();
    for (const key of pageMap.keys()) {
      pageMapLower.set(key.toLowerCase(), key);
    }
    const resolveCanonical = (name: string): string | null =>
      pageMap.has(name) ? name : (pageMapLower.get(name.toLowerCase()) ?? null);

    // Detect cycles: only mark nodes that are actually within the cycle loop.
    const inCycle = new Set<string>();
    for (const p of pages) {
      const visitedOrder: string[] = [];
      const visitedSet = new Set<string>();
      let current: string | null = p.file.name;
      while (current !== null) {
        if (visitedSet.has(current)) {
          // Mark only the cycle members (from first occurrence of 'current' onward)
          const cycleStart = visitedOrder.indexOf(current);
          for (let i = cycleStart; i < visitedOrder.length; i++) {
            inCycle.add(visitedOrder[i]);
          }
          break;
        }
        visitedOrder.push(current);
        visitedSet.add(current);
        const page = pageMap.get(current);
        if (!page) break;
        const parentRaw = page[FM_KEY.PARENT];
        const rawNext = parentRaw ? (normalizeToName(parentRaw) ?? null) : null;
        current = rawNext ? resolveCanonical(rawNext) : null;
      }
    }

    // Build tree: only assign children if parent is resolvable and not in a cycle
    const childrenMap = new Map<string, TopicNode[]>();
    const roots: TopicNode[] = [];
    const nodeMap = new Map<string, TopicNode>();

    for (const p of pages) {
      const node: TopicNode = { name: p.file.name, page: p, children: [] };
      nodeMap.set(p.file.name, node);
    }

    for (const p of pages) {
      const node = nodeMap.get(p.file.name);
      if (!node) continue;
      const rawParentName = p[FM_KEY.PARENT] ? (normalizeToName(p[FM_KEY.PARENT]) ?? null) : null;
      const parentName = rawParentName ? resolveCanonical(rawParentName) : null;
      if (parentName && !inCycle.has(p.file.name)) {
        let siblings = childrenMap.get(parentName);
        if (!siblings) {
          siblings = [];
          childrenMap.set(parentName, siblings);
        }
        siblings.push(node);
      } else {
        roots.push(node);
      }
    }

    // Attach children to each node
    for (const [parentName, children] of childrenMap) {
      const parentNode = nodeMap.get(parentName);
      if (parentNode) {
        parentNode.children = children.sort((a, b) => a.name.localeCompare(b.name));
      }
    }

    return roots.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Returns all descendant topic names at all depths for the given topic name.
   * Does NOT include the topic itself — only its children, grandchildren, etc.
   * Guards against cycles (safe because getReferenceTopicTree already breaks cycles, but
   * this method also uses a visitedSet just in case).
   */
  getTopicDescendants(topicName: string): string[] {
    const tree = this.getReferenceTopicTree();
    const result: string[] = [];

    const findNode = (nodes: TopicNode[], name: string): TopicNode | null => {
      for (const n of nodes) {
        if (n.name === name) return n;
        const found = findNode(n.children, name);
        if (found) return found;
      }
      return null;
    };

    const collectDescendants = (node: TopicNode, visited: Set<string>): void => {
      for (const child of node.children) {
        if (visited.has(child.name)) continue;
        visited.add(child.name);
        result.push(child.name);
        collectDescendants(child, visited);
      }
    };

    const root = findNode(tree, topicName);
    if (root) {
      const visited = new Set<string>([topicName]);
      collectDescendants(root, visited);
    }
    return result;
  }
}
