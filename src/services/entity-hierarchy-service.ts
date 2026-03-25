import type { DataviewPage } from "../types";
import { normalizeToName } from "../utils/link-utils";
import type { IEntityHierarchyService, IQueryService } from "./interfaces";

/**
 * Centralised entity hierarchy resolution.
 *
 * Resolves client and engagement names from a DataviewPage by walking the
 * engagement → client chain when a direct frontmatter link is absent.
 * All consumers (RAID dashboard, task filter, reference views) should use
 * this service rather than duplicating the dual-path logic inline.
 */
export class EntityHierarchyService implements IEntityHierarchyService {
  constructor(private readonly queryService: IQueryService) {}

  /**
   * Returns the client name for a page.
   *
   * Resolution order:
   *   1. normalizeToName(page.client) — direct client frontmatter link
   *   2. getEngagementNameForPath(page.file.path) → getClientFromEngagementLink — covers
   *      the direct engagement field, relatedProject → project.engagement, and
   *      recurring-meeting-event → meeting.engagement chains
   *
   * Returns null if neither path yields a name.
   */
  resolveClientName(page: DataviewPage): string | null {
    const direct = normalizeToName(page.client);
    if (direct) return direct;

    const engName = this.queryService.getEngagementNameForPath(page.file?.path ?? "");
    if (engName) return this.queryService.getClientFromEngagementLink(engName) ?? null;

    return null;
  }

  /**
   * Returns the engagement name for a page.
   * Delegates to queryService.getEngagementNameForPath which handles direct
   * engagement links as well as project-note and recurring-meeting-event chains.
   */
  resolveEngagementName(page: DataviewPage): string | null {
    return this.queryService.getEngagementNameForPath(page.file?.path ?? "");
  }
}
