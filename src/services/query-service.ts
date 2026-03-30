import { App, TFile } from "obsidian";
import type { DataviewApi, DataviewPage, TopicNode } from "../types";
import { normalizeToName } from "../utils/link-utils";
import { STATUS, ENTITY_TAGS } from "../constants";
import type { FolderSettings } from "../settings";
import type { IQueryService } from "./interfaces";

/** RAID item statuses considered inactive — excluded from active item queries. */
const RAID_INACTIVE_STATUSES = new Set(["Resolved", "Closed"]);

/**
 * Wraps the Dataview plugin API to provide typed entity queries.
 *
 * Uses `dv.pages(source)` patterns to query by tag and folder,
 * mirroring the behaviour of the vault's dataview scripts.
 *
 * The Dataview API reference is obtained lazily (via `getApi()`) so the
 * service can be constructed before Dataview has fully initialised.
 */
export class QueryService implements IQueryService {
  constructor(
    private readonly app: App,
    private readonly getApi: () => DataviewApi | null,
    private readonly folders: FolderSettings
  ) {}

  // ─── Internal helpers ───────────────────────────────────────────────────

  dv(): DataviewApi | null {
    return this.getApi();
  }

  /** Converts a TFile into a source string usable in dv.pages("[[Name]]"). */
  private fileToSource(file: TFile): string {
    return `"${file.path}"`;
  }

  // ─── Tag + folder queries ────────────────────────────────────────────────

  /**
   * Returns all pages matching a Dataview tag (e.g. "#client").
   * Optionally constrained to a specific folder.
   */
  getEntitiesByTag(tag: string, folder?: string): DataviewPage[] {
    const dv = this.dv();
    if (!dv) return [];
    let pages = dv.pages(tag);
    if (folder) {
      pages = pages.where((p) => p.file.folder === folder);
    }
    return [...pages];
  }

  /**
   * Returns pages matching a tag filtered by status value(s).
   */
  getEntitiesByStatus(tag: string, status: string | string[]): DataviewPage[] {
    const dv = this.dv();
    if (!dv) return [];
    const statuses = Array.isArray(status) ? status : [status];
    return [...dv.pages(tag).where((p) => statuses.includes(String(p.status ?? "")))];
  }

  /**
   * Returns active entities (status === "Active") for a given tag.
   * Used to populate entity suggester modals.
   */
  getActiveEntitiesByTag(tag: string): DataviewPage[] {
    return this.getEntitiesByStatus(tag, STATUS.ACTIVE);
  }

  // ─── Relationship traversal ──────────────────────────────────────────────

  /**
   * Returns pages where a given frontmatter property links to the target file.
   * Mirrors the `dv.func.contains(b.property, link)` pattern used in vault scripts.
   *
   * @param folder   - Folder to constrain results (e.g. "engagements")
   * @param tag      - Dataview tag filter (e.g. "#engagement")
   * @param property - Frontmatter property name to check (e.g. "client")
   * @param targetFile - The file whose link to look for
   */
  getLinkedEntities(
    folder: string,
    tag: string,
    property: string,
    targetFile: TFile
  ): DataviewPage[] {
    const dv = this.dv();
    if (!dv) return [];

    const targetName = targetFile.basename;
    return [
      ...dv
        .pages(tag)
        .where((p) => p.file.folder === folder)
        .where((p) => {
          const val = p[property];
          return normalizeToName(val) === targetName;
        }),
    ];
  }

  /**
   * Returns all pages that backlink (mention) the target file.
   * Mirrors the `dv.pages("[[FileName]]")` pattern.
   */
  getMentions(targetFile: TFile): DataviewPage[] {
    const dv = this.dv();
    if (!dv) return [];
    return [...dv.pages(`[[${targetFile.basename}]]`)];
  }

  /**
   * Returns project notes (pages with relatedProject linking to the given project file).
   */
  getProjectNotes(projectFile: TFile): DataviewPage[] {
    const dv = this.dv();
    if (!dv) return [];
    const projectName = projectFile.basename;
    return [
      ...dv
        .pages()
        .where((p) => normalizeToName(p.relatedProject) === projectName),
    ];
  }

  // ─── Hierarchy traversal ─────────────────────────────────────────────────

  /**
   * Walks the frontmatter chain to find the engagement linked to a file.
   * Supports: file.engagement, (for project notes) file.relatedProject → project.engagement,
   *           or (for recurring meeting events) file["recurring-meeting"] → meeting.engagement
   */
  getEngagementForEntity(file: TFile): DataviewPage | null {
    const dv = this.dv();
    if (!dv) return null;

    const engName = this.getEngagementNameForPath(file.path);
    if (!engName) return null;

    return dv.page(`${this.folders.engagements}/${engName}`) ?? null;
  }

  /**
   * Walks the hierarchy to find the client linked to a file.
   * Chain: file.client → file.engagement.client → file.relatedProject.engagement.client
   */
  getClientForEntity(file: TFile): DataviewPage | null {
    const dv = this.dv();
    if (!dv) return null;

    const page = dv.page(file.path);
    if (!page) return null;

    // Direct client link
    if (page.client) {
      const clientName = normalizeToName(page.client);
      if (clientName) return dv.page(`${this.folders.clients}/${clientName}`);
    }

    // Through engagement
    const engagement = this.getEngagementForEntity(file);
    if (engagement?.client) {
      const clientName = normalizeToName(engagement.client);
      if (clientName) return dv.page(`${this.folders.clients}/${clientName}`);
    }

    return null;
  }

  /**
   * Returns the parent project page for a project note file.
   * Returns null if the file is not a project note.
   */
  getParentProject(file: TFile): DataviewPage | null {
    const dv = this.dv();
    if (!dv) return null;

    const page = dv.page(file.path);
    if (!page?.relatedProject) return null;

    const projectName = normalizeToName(page.relatedProject);
    if (!projectName) return null;

    return dv.page(`${this.folders.projects}/${projectName}`);
  }

  /**
   * Returns the engagement name for any entity file by path.
   * Walks the same traversal chains as getEngagementForEntity but accepts a
   * path string and returns the name rather than the full page — suitable for
   * use in task filter methods that only have a path available.
   *
   * Chains: direct engagement, relatedProject → project.engagement,
   *         recurring-meeting → recurring meeting.engagement
   */
  getEngagementNameForPath(path: string): string | null {
    const dv = this.dv();
    if (!dv) return null;

    const page = dv.page(path);
    if (!page) return null;

    // Direct engagement link
    const direct = normalizeToName(page.engagement);
    if (direct) return direct;

    // For project notes: resolve via parent project
    if (page.relatedProject) {
      const projectName = normalizeToName(page.relatedProject);
      if (projectName) {
        const project = dv.page(`${this.folders.projects}/${projectName}`);
        const engName = project ? normalizeToName(project.engagement) : null;
        if (engName) return engName;
      }
    }

    // For recurring meeting events: resolve via parent recurring meeting
    if (page["recurring-meeting"]) {
      const meetingName = normalizeToName(page["recurring-meeting"]);
      if (meetingName) {
        const meeting = dv.page(`${this.folders.meetingsRecurring}/${meetingName}`);
        const engName = meeting ? normalizeToName(meeting.engagement) : null;
        if (engName) return engName;
      }
    }

    return null;
  }

  /**
   * Returns the client name string for an engagement link (any format).
   * Used during task filtering to traverse engagement → client.
   */
  getClientFromEngagementLink(engagementLink: unknown): string | null {
    const dv = this.dv();
    if (!dv) return null;

    const engName = normalizeToName(engagementLink);
    if (!engName) return null;

    const engPage = dv.page(`${this.folders.engagements}/${engName}`);
    return engPage ? (normalizeToName(engPage.client) ?? null) : null;
  }

  /**
   * Returns the Dataview page for a given vault path.
   */
  getPage(path: string): DataviewPage | null {
    return this.dv()?.page(path) ?? null;
  }

  /**
   * Returns all active recurring meetings (those without an end-date).
   */
  getActiveRecurringMeetings(): DataviewPage[] {
    const dv = this.dv();
    if (!dv) return [];
    return [
      ...dv.pages(`"${this.folders.meetingsRecurring}"`).where((p) => !p["end-date"]),
    ];
  }

  /**
   * Returns all event notes for a given recurring meeting.
   * Events are matched by the "recurring-meeting" frontmatter property.
   */
  getRecurringMeetingEvents(meetingName: string): DataviewPage[] {
    const dv = this.dv();
    if (!dv) return [];
    return [
      ...dv
        .pages(`"${this.folders.meetingsRecurringEvents}"`)
        .where((p) => normalizeToName(p["recurring-meeting"]) === meetingName),
    ];
  }

  /**
   * Returns all RAID items regardless of status, sorted by raised-date descending.
   */
  getAllRaidItems(): DataviewPage[] {
    const dv = this.dv();
    if (!dv) return [];
    return [
      ...dv
        .pages(ENTITY_TAGS.raid)
        .sort((p: DataviewPage) => p["raised-date"], "desc"),
    ];
  }

  /**
   * Returns active RAID items (status not Resolved or Closed), sorted by raised-date descending.
   */
  getActiveRaidItems(): DataviewPage[] {
    const dv = this.dv();
    if (!dv) return [];
    return [
      ...dv
        .pages(ENTITY_TAGS.raid)
        .where((p: DataviewPage) => !RAID_INACTIVE_STATUSES.has(String(p.status ?? "")))
        .sort((p: DataviewPage) => p["raised-date"], "desc"),
    ];
  }

  /**
   * Returns active RAID items (status not Resolved or Closed) optionally filtered
   * by client or engagement name. If neither filter is provided, returns all active items.
   *
   * Client matching uses dual-path resolution: direct page.client field OR
   * page.engagement → engagement.client traversal.
   */
  getRaidItemsForContext(clientName?: string, engagementName?: string): DataviewPage[] {
    const dv = this.dv();
    if (!dv) return [];
    const pages = [
      ...dv
        .pages(ENTITY_TAGS.raid)
        .where((p: DataviewPage) => !RAID_INACTIVE_STATUSES.has(String(p.status ?? ""))),
    ] as DataviewPage[];
    if (!clientName && !engagementName) return pages;
    const normalizedClientName = normalizeToName(clientName) ?? "";
    const normalizedEngagementName = normalizeToName(engagementName) ?? "";
    return pages.filter((p: DataviewPage) => {
      const client = this.resolveClientName(p) ?? "";
      const engagement = normalizeToName(p.engagement) ?? "";
      return (
        (normalizedClientName && client === normalizedClientName) ||
        (normalizedEngagementName && engagement === normalizedEngagementName)
      );
    });
  }

  /**
   * Returns all Reference pages where topics[] contains [[topicName]].
   */
  getReferencesByTopic(topicName: string): DataviewPage[] {
    const dv = this.dv();
    if (!dv) return [];
    return [
      ...dv.pages(ENTITY_TAGS.reference).where((p: DataviewPage) => {
        const topics = p.topics;
        if (!Array.isArray(topics)) return false;
        return topics.some((t) => normalizeToName(t) === topicName);
      }),
    ];
  }

  /**
   * Returns Reference pages matching optional filters.
   * topics/clients/engagements use OR logic within each dimension; AND across dimensions.
   * Client resolves via direct reference.client OR reference.engagement → engagement.client.
   */
  getReferences(filters?: { topics?: string[]; clients?: string[]; engagements?: string[] }): DataviewPage[] {
    const dv = this.dv();
    if (!dv) return [];
    const all = [...dv.pages(ENTITY_TAGS.reference)] as DataviewPage[];
    if (!filters) return all;

    return all.filter((p: DataviewPage) => {
      // Topics filter (OR)
      if (filters.topics && filters.topics.length > 0) {
        const topics = Array.isArray(p.topics) ? p.topics : [];
        const match = filters.topics.some((ft) =>
          topics.some((t) => normalizeToName(t) === normalizeToName(ft))
        );
        if (!match) return false;
      }

      // Client filter (OR) — dual-path: direct client OR via engagement
      if (filters.clients && filters.clients.length > 0) {
        const resolvedClient = this.resolveClientName(p) ?? "";
        if (!filters.clients.includes(resolvedClient)) return false;
      }

      // Engagement filter (OR)
      if (filters.engagements && filters.engagements.length > 0) {
        const eng = normalizeToName(p.engagement) ?? "";
        if (!filters.engagements.includes(eng)) return false;
      }

      return true;
    });
  }

  /**
   * Resolves the client name for a page using the dual-path traversal chain:
   *   1. normalizeToName(page.client) — direct client frontmatter link
   *   2. getEngagementNameForPath → getClientFromEngagementLink — covers direct
   *      engagement, relatedProject → project.engagement, and
   *      recurring-meeting-event → meeting.engagement chains
   * Returns null if neither path yields a name.
   */
  resolveClientName(page: DataviewPage): string | null {
    const direct = normalizeToName(page.client);
    if (direct) return direct;
    const engName = this.getEngagementNameForPath(page.file?.path ?? "");
    if (engName) return this.getClientFromEngagementLink(engName);
    return null;
  }

  /**
   * Builds the full Reference Topic tree from all #reference-topic pages.
   * Root nodes: topics with no parent field, or whose parent cannot be resolved.
   * Children are sorted alphabetically at each level.
   * Guards against circular parent references — topics in a cycle are treated as roots.
   */
  getReferenceTopicTree(): TopicNode[] {
    const dv = this.dv();
    if (!dv) return [];

    const pages = [...dv.pages(ENTITY_TAGS.referenceTopic)] as DataviewPage[];
    const pageMap = new Map<string, DataviewPage>();
    for (const p of pages) {
      pageMap.set(p.file.name, p);
    }

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
        const parentRaw = page.parent;
        current = parentRaw ? (normalizeToName(parentRaw) ?? null) : null;
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
      const parentName = p.parent ? (normalizeToName(p.parent) ?? null) : null;
      if (parentName && pageMap.has(parentName) && !inCycle.has(p.file.name)) {
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
