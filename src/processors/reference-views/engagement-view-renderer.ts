import type { DataviewPage } from "../../types";
import type { ReferenceProcessorServices } from "../../plugin-context";
import { normalizeToName } from "../../utils/link-utils";
import { renderCollapsibleGroup, renderReferenceCard, renderEmptyState } from "./topic-view-renderer";

const UNASSIGNED_LABEL = "Unassigned";

/**
 * Renders references grouped by engagement.
 * References with no engagement are collected into an "Unassigned" group at the bottom.
 */
export function renderEngagementView(
  container: HTMLElement,
  references: DataviewPage[],
  _services: ReferenceProcessorServices
): void {
  const groups = new Map<string, DataviewPage[]>();
  const unassigned: DataviewPage[] = [];

  for (const ref of references) {
    const engagementName = normalizeToName(ref.engagement);

    if (engagementName) {
      let bucket = groups.get(engagementName);
      if (!bucket) {
        bucket = [];
        groups.set(engagementName, bucket);
      }
      bucket.push(ref);
    } else {
      unassigned.push(ref);
    }
  }

  // Sort named groups alphabetically
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  if (sortedGroups.length === 0 && unassigned.length === 0) {
    renderEmptyState(container, "No references found.");
    return;
  }

  for (const [engagementName, refs] of sortedGroups) {
    const groupBody = renderCollapsibleGroup(container, engagementName, refs.length);
    for (const ref of refs) {
      renderReferenceCard(groupBody, ref);
    }
  }

  // Unassigned group always at the bottom
  if (unassigned.length > 0) {
    const groupBody = renderCollapsibleGroup(container, UNASSIGNED_LABEL, unassigned.length);
    for (const ref of unassigned) {
      renderReferenceCard(groupBody, ref);
    }
  }
}
