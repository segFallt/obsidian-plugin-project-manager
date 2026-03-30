import type { DataviewPage } from "../../types";
import type { ReferenceProcessorServices } from "../../plugin-context";
import { renderCollapsibleGroup, renderReferenceCard, renderEmptyState } from "./topic-view-renderer";

const UNASSIGNED_LABEL = "Unassigned";

/**
 * Renders the client sidebar (flat alphabetical list) and content panel (grouped by client).
 */
export function renderClientView(
  sidebar: HTMLElement,
  panel: HTMLElement,
  references: DataviewPage[],
  services: ReferenceProcessorServices,
  selectedNode: string | undefined,
  onNodeSelect: (node: string | undefined) => void
): void {
  // Build client list from all references (not just filtered)
  const allRefs = services.queryService.getReferences();
  const clientNames = new Set<string>();
  for (const ref of allRefs) {
    const name = services.hierarchyService.resolveClientName(ref);
    if (name) clientNames.add(name);
  }
  const sortedClients = [...clientNames].sort((a, b) => a.localeCompare(b));

  // Sidebar
  for (const clientName of sortedClients) {
    const isSelected = selectedNode === clientName;
    const itemEl = sidebar.createDiv({
      cls: `pm-ref-sidebar__item${isSelected ? " pm-ref-sidebar__item--selected" : ""}`,
      text: clientName,
    });
    itemEl.addEventListener("click", () => {
      onNodeSelect(isSelected ? undefined : clientName);
    });
  }

  // Content panel: filter by selected client if set
  let filtered = references;
  if (selectedNode) {
    filtered = references.filter((ref) => services.hierarchyService.resolveClientName(ref) === selectedNode);
  }

  const groups = new Map<string, DataviewPage[]>();
  const unassigned: DataviewPage[] = [];

  for (const ref of filtered) {
    const clientName = services.hierarchyService.resolveClientName(ref);
    if (clientName) {
      let bucket = groups.get(clientName);
      if (!bucket) { bucket = []; groups.set(clientName, bucket); }
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

  for (const [clientName, refs] of sortedGroups) {
    const groupBody = renderCollapsibleGroup(panel, clientName, refs.length);
    for (const ref of refs) renderReferenceCard(groupBody, ref);
  }

  if (unassigned.length > 0) {
    const groupBody = renderCollapsibleGroup(panel, UNASSIGNED_LABEL, unassigned.length);
    for (const ref of unassigned) renderReferenceCard(groupBody, ref);
  }
}
