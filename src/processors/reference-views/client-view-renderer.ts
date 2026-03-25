import type { DataviewPage } from "../../types";
import type { ReferenceProcessorServices } from "../../plugin-context";
import { renderCollapsibleGroup, renderReferenceCard, renderEmptyState } from "./topic-view-renderer";

const UNASSIGNED_LABEL = "Unassigned";

/**
 * Renders references grouped by resolved client.
 * Client resolution is delegated to hierarchyService.resolveClientName, which
 * handles direct client links and engagement → client traversal.
 * References with no resolved client are collected into an "Unassigned" group
 * appended at the bottom.
 */
export function renderClientView(
  container: HTMLElement,
  references: DataviewPage[],
  services: ReferenceProcessorServices
): void {
  const groups = new Map<string, DataviewPage[]>();
  const unassigned: DataviewPage[] = [];

  for (const ref of references) {
    const clientName = services.hierarchyService.resolveClientName(ref);

    if (clientName) {
      let bucket = groups.get(clientName);
      if (!bucket) {
        bucket = [];
        groups.set(clientName, bucket);
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

  for (const [clientName, refs] of sortedGroups) {
    const groupBody = renderCollapsibleGroup(container, clientName, refs.length);
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
