import type { DataviewPage } from "../types";
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
   * Delegates to queryService.resolveClientName which owns the dual-path
   * traversal logic (direct client field, or engagement → client chain).
   */
  resolveClientName(page: DataviewPage): string | null {
    return this.queryService.resolveClientName(page);
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
