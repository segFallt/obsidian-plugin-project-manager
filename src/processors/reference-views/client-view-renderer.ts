import type { DataviewPage } from "../../types";
import type { ReferenceProcessorServices } from "../../plugin-context";
import { normalizeToName } from "../../utils/link-utils";
import { renderCollapsibleGroup, renderReferenceCard, renderEmptyState } from "./topic-view-renderer";

const UNASSIGNED_LABEL = "Unassigned";

/**
 * Renders references grouped by resolved client.
 *
 * Client resolution uses a dual-path:
 *   1. normalizeToName(ref.client) — direct client link on the reference
 *   2. If the reference has an engagement but no direct client, resolve the
 *      client via queryService.getClientFromEngagementLink(ref.engagement)
 *
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
    let clientName = normalizeToName(ref.client);

    // Dual-path: resolve client from engagement if direct client is absent
    if (!clientName && ref.engagement) {
      clientName = services.queryService.getClientFromEngagementLink(ref.engagement);
    }

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
