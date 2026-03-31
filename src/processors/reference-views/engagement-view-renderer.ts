import type { DataviewPage } from "../../types";
import type { ReferenceProcessorServices } from "../../plugin-context";
import { renderCollapsibleGroup, renderReferenceCard, renderEmptyState } from "./topic-view-renderer";

const UNASSIGNED_LABEL = "Unassigned";

/**
 * Renders the engagement sidebar (flat alphabetical list) and content panel (grouped by engagement).
 */
export function renderEngagementView(
  sidebar: HTMLElement,
  panel: HTMLElement,
  references: DataviewPage[],
  services: ReferenceProcessorServices,
  selectedNode: string | undefined,
  onNodeSelect: (node: string | undefined) => void
): void {
  // Build engagement list from all references
  const allRefs = services.queryService.getReferences();
  const engagementNames = new Set<string>();
  for (const ref of allRefs) {
    const name = services.hierarchyService.resolveEngagementName(ref);
    if (name) engagementNames.add(name);
  }
  const sortedEngagements = [...engagementNames].sort((a, b) => a.localeCompare(b));

  // Sidebar
  for (const engagementName of sortedEngagements) {
    const isSelected = selectedNode === engagementName;
    const itemEl = sidebar.createDiv({
      cls: `pm-ref-sidebar__item${isSelected ? " pm-ref-sidebar__item--selected" : ""}`,
      text: engagementName,
    });
    itemEl.addEventListener("click", () => {
      onNodeSelect(isSelected ? undefined : engagementName);
    });
  }

  // Content panel
  let filtered = references;
  if (selectedNode) {
    filtered = references.filter((ref) => services.hierarchyService.resolveEngagementName(ref) === selectedNode);
  }

  const groups = new Map<string, DataviewPage[]>();
  const unassigned: DataviewPage[] = [];

  for (const ref of filtered) {
    const engagementName = services.hierarchyService.resolveEngagementName(ref);
    if (engagementName) {
      let bucket = groups.get(engagementName);
      if (!bucket) { bucket = []; groups.set(engagementName, bucket); }
      bucket.push(ref);
    } else {
      unassigned.push(ref);
    }
  }

  const sortedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  if (sortedGroups.length === 0 && unassigned.length === 0) {
    renderEmptyState(panel, "No references found.");
    return;
  }

  for (const [engagementName, refs] of sortedGroups) {
    const groupBody = renderCollapsibleGroup(panel, engagementName, refs.length);
    for (const ref of refs) renderReferenceCard(groupBody, ref, services);
  }

  if (unassigned.length > 0) {
    const groupBody = renderCollapsibleGroup(panel, UNASSIGNED_LABEL, unassigned.length);
    for (const ref of unassigned) renderReferenceCard(groupBody, ref, services);
  }
}
