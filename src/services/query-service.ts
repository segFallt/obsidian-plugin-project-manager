import { App, TFile } from "obsidian";
import type { DataviewApi, DataviewPage } from "../types";
import { normalizeToName } from "../utils/link-utils";
import { STATUS } from "../constants";
import type { FolderSettings } from "../settings";
import type { IQueryService } from "./interfaces";

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
   * Supports: file.engagement or (for project notes) file.relatedProject → project.engagement
   */
  getEngagementForEntity(file: TFile): DataviewPage | null {
    const dv = this.dv();
    if (!dv) return null;

    const page = dv.page(file.path);
    if (!page) return null;

    // Direct engagement link
    if (page.engagement) {
      const engName = normalizeToName(page.engagement);
      if (engName) return dv.page(`${this.folders.engagements}/${engName}`);
    }

    // For project notes: resolve via parent project
    if (page.relatedProject) {
      const parentProject = this.getParentProject(file);
      if (parentProject?.engagement) {
        const engName = normalizeToName(parentProject.engagement);
        if (engName) return dv.page(`${this.folders.engagements}/${engName}`);
      }
    }

    return null;
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
}
