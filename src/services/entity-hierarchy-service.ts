import type { TFile } from "obsidian";
import type { DataviewApi, DataviewPage } from "../types";
import { normalizeToName } from "../utils/link-utils";
import { FM_KEY } from "../constants";
import type { FolderSettings } from "../settings";
import type { IEntityHierarchyService } from "./interfaces";

/**
 * Centralised entity hierarchy resolution.
 *
 * Resolves client and engagement names (and their pages) from a DataviewPage by
 * walking the frontmatter chain when a direct link is absent. All consumers —
 * RAID dashboard, task filter, reference views — use this service rather than
 * duplicating the traversal inline.
 *
 * The Dataview API reference is obtained lazily (via `getDv()`) so the service
 * can be constructed before Dataview has fully initialised; every method guards
 * against a null API.
 */
export class EntityHierarchyService implements IEntityHierarchyService {
  constructor(
    private readonly getDv: () => DataviewApi | null,
    private readonly folders: FolderSettings
  ) {}

  /**
   * Resolves the client name for a page:
   *   1. `normalizeToName(page.client)` — direct client frontmatter link.
   *   2. engagement → client chain via {@link getEngagementNameForPath} +
   *      {@link getClientFromEngagementLink} (covers direct engagement,
   *      relatedProject → project.engagement, and
   *      recurring-meeting-event → meeting.engagement).
   *   3. parent-project fallback — when the page is a project note whose parent
   *      project carries a client the chain above could not surface, resolve the
   *      parent project's own client (direct + engagement chain).
   * Returns null when no path yields a name.
   */
  resolveClientName(page: DataviewPage): string | null {
    const own = this.resolveDirectOrEngagementClient(page);
    if (own) return own;

    // Fallback: project note → its parent project's client. Resolved via the
    // parent's direct/engagement chain only (not recursively through another
    // relatedProject), which both preserves the prior single-level behaviour and
    // avoids unbounded recursion on a malformed parent chain.
    const relatedProject = page[FM_KEY.RELATED_PROJECT];
    if (relatedProject) {
      const dv = this.getDv();
      const parentName = normalizeToName(relatedProject);
      if (dv && parentName) {
        const parentPage = dv.page(`${this.folders.projects}/${parentName}`);
        if (parentPage) return this.resolveDirectOrEngagementClient(parentPage);
      }
    }

    return null;
  }

  /** Direct client link, else the engagement → client chain; null if neither yields a name. */
  private resolveDirectOrEngagementClient(page: DataviewPage): string | null {
    const direct = normalizeToName(page[FM_KEY.CLIENT]);
    if (direct) return direct;

    const engName = this.getEngagementNameForPath(page.file?.path ?? "");
    if (engName) {
      const engClient = this.getClientFromEngagementLink(engName);
      if (engClient) return engClient;
    }

    return null;
  }

  /**
   * Returns the engagement name for a page — the {@link getEngagementNameForPath}
   * traversal keyed off the page's file path.
   */
  resolveEngagementName(page: DataviewPage): string | null {
    return this.getEngagementNameForPath(page.file?.path ?? "");
  }

  /**
   * Walks the frontmatter chain to find the engagement page linked to a file.
   * Supports: file.engagement, (for project notes) file.relatedProject →
   * project.engagement, or (for recurring meeting events)
   * file["recurring-meeting"] → meeting.engagement.
   */
  getEngagementForEntity(file: TFile): DataviewPage | null {
    const dv = this.getDv();
    if (!dv) return null;

    const engName = this.getEngagementNameForPath(file.path);
    if (!engName) return null;

    return dv.page(`${this.folders.engagements}/${engName}`) ?? null;
  }

  /**
   * Walks the hierarchy to find the client page linked to a file.
   * Chain: file.client → file.engagement.client.
   */
  getClientForEntity(file: TFile): DataviewPage | null {
    const dv = this.getDv();
    if (!dv) return null;

    const page = dv.page(file.path);
    if (!page) return null;

    // Direct client link
    if (page[FM_KEY.CLIENT]) {
      const clientName = normalizeToName(page[FM_KEY.CLIENT]);
      if (clientName) return dv.page(`${this.folders.clients}/${clientName}`);
    }

    // Through engagement
    const engagement = this.getEngagementForEntity(file);
    if (engagement?.[FM_KEY.CLIENT]) {
      const clientName = normalizeToName(engagement[FM_KEY.CLIENT]);
      if (clientName) return dv.page(`${this.folders.clients}/${clientName}`);
    }

    return null;
  }

  /**
   * Returns the parent project page for a project note file.
   * Returns null if the file is not a project note.
   */
  getParentProject(file: TFile): DataviewPage | null {
    const dv = this.getDv();
    if (!dv) return null;

    const page = dv.page(file.path);
    if (!page?.[FM_KEY.RELATED_PROJECT]) return null;

    const projectName = normalizeToName(page[FM_KEY.RELATED_PROJECT]);
    if (!projectName) return null;

    return dv.page(`${this.folders.projects}/${projectName}`);
  }

  /**
   * Returns the engagement name for any entity file by path, walking the same
   * chains as {@link getEngagementForEntity}: direct engagement,
   * relatedProject → project.engagement, and
   * recurring-meeting → meeting.engagement.
   */
  getEngagementNameForPath(path: string): string | null {
    const dv = this.getDv();
    if (!dv) return null;

    const page = dv.page(path);
    if (!page) return null;

    // Direct engagement link
    const direct = normalizeToName(page[FM_KEY.ENGAGEMENT]);
    if (direct) return direct;

    // For project notes: resolve via parent project
    if (page[FM_KEY.RELATED_PROJECT]) {
      const projectName = normalizeToName(page[FM_KEY.RELATED_PROJECT]);
      if (projectName) {
        const project = dv.page(`${this.folders.projects}/${projectName}`);
        const engName = project ? normalizeToName(project[FM_KEY.ENGAGEMENT]) : null;
        if (engName) return engName;
      }
    }

    // For recurring meeting events: resolve via parent recurring meeting
    if (page[FM_KEY.RECURRING_MEETING]) {
      const meetingName = normalizeToName(page[FM_KEY.RECURRING_MEETING]);
      if (meetingName) {
        const meeting = dv.page(`${this.folders.meetingsRecurring}/${meetingName}`);
        const engName = meeting ? normalizeToName(meeting[FM_KEY.ENGAGEMENT]) : null;
        if (engName) return engName;
      }
    }

    return null;
  }

  /**
   * Returns the client name string for an engagement link (any format).
   * Resolves the engagement page and reads its client frontmatter.
   */
  getClientFromEngagementLink(engagementLink: unknown): string | null {
    const dv = this.getDv();
    if (!dv) return null;

    const engName = normalizeToName(engagementLink);
    if (!engName) return null;

    const engPage = dv.page(`${this.folders.engagements}/${engName}`);
    return engPage ? (normalizeToName(engPage[FM_KEY.CLIENT]) ?? null) : null;
  }
}
