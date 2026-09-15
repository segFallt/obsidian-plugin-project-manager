import type { DataviewPage, ReferenceFilters } from "../../types";
import { normalizeToName } from "../../utils/link-utils";
import { CSS_CLS, DOM_EVENT, REFERENCES_DASHBOARD_TEXT } from "../../constants";
import type { IViewRenderer, ViewRenderContext } from "../view-renderer";
import {
  renderCollapsibleGroup,
  renderReferenceCard,
  renderEmptyState,
} from "./reference-card-renderer";
import type { RefRenderHelpers } from "./reference-card-renderer";

/** Resolves the grouping name (client or engagement) for a reference. */
type ResolveName = (ref: DataviewPage) => string | null;

/**
 * The References "By Client" / "By Engagement" views — a single renderer
 * parameterised by which resolved name it groups on. The sidebar lists every
 * distinct name from the UNFILTERED node-set (`ctx.helpers.allReferences`); the
 * content panel groups the already-filtered `ctx.items`, scoped to the selected
 * sidebar node, with an "Unassigned" bucket for references that resolve to none.
 */
export class FlatGroupedViewRenderer
  implements IViewRenderer<DataviewPage, RefRenderHelpers, ReferenceFilters>
{
  constructor(
    readonly mode: string,
    private readonly resolveName: ResolveName
  ) {}

  render(ctx: ViewRenderContext<DataviewPage, RefRenderHelpers, ReferenceFilters>): void {
    const sidebar = ctx.container.createDiv({ cls: CSS_CLS.REFERENCES_SIDEBAR });
    const panel = ctx.container.createDiv({ cls: CSS_CLS.REFERENCES_PANEL });

    const selectedNode = ctx.filters.selectedNode
      ? (normalizeToName(ctx.filters.selectedNode) ?? undefined)
      : undefined;

    this.renderSidebar(sidebar, ctx.helpers.allReferences, selectedNode, (node) =>
      ctx.onFilterChange({ selectedNode: node })
    );
    this.renderContent(panel, ctx.items, selectedNode, ctx.helpers);
  }

  private renderSidebar(
    sidebar: HTMLElement,
    allReferences: DataviewPage[],
    selectedNode: string | undefined,
    onNodeSelect: (node: string | undefined) => void
  ): void {
    const names = new Set<string>();
    for (const ref of allReferences) {
      const name = this.resolveName(ref);
      if (name) names.add(name);
    }
    const sorted = [...names].sort((a, b) => a.localeCompare(b));

    for (const name of sorted) {
      const isSelected = selectedNode === name;
      const itemEl = sidebar.createDiv({
        cls: isSelected
          ? `${CSS_CLS.REF_SIDEBAR_ITEM} ${CSS_CLS.REF_SIDEBAR_ITEM_SELECTED}`
          : CSS_CLS.REF_SIDEBAR_ITEM,
        text: name,
      });
      itemEl.addEventListener(DOM_EVENT.CLICK, () => {
        onNodeSelect(isSelected ? undefined : name);
      });
    }
  }

  private renderContent(
    panel: HTMLElement,
    items: DataviewPage[],
    selectedNode: string | undefined,
    helpers: RefRenderHelpers
  ): void {
    let filtered = items;
    if (selectedNode) {
      filtered = items.filter((ref) => this.resolveName(ref) === selectedNode);
    }

    const groups = new Map<string, DataviewPage[]>();
    const unassigned: DataviewPage[] = [];

    for (const ref of filtered) {
      const name = this.resolveName(ref);
      if (name) {
        let bucket = groups.get(name);
        if (!bucket) { bucket = []; groups.set(name, bucket); }
        bucket.push(ref);
      } else {
        unassigned.push(ref);
      }
    }

    const sortedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

    if (sortedGroups.length === 0 && unassigned.length === 0) {
      renderEmptyState(panel, REFERENCES_DASHBOARD_TEXT.NO_REFERENCES);
      return;
    }

    for (const [name, refs] of sortedGroups) {
      const groupBody = renderCollapsibleGroup(panel, name, refs.length);
      for (const ref of refs) renderReferenceCard(groupBody, ref, helpers.cardServices);
    }

    if (unassigned.length > 0) {
      const groupBody = renderCollapsibleGroup(panel, REFERENCES_DASHBOARD_TEXT.UNASSIGNED, unassigned.length);
      for (const ref of unassigned) renderReferenceCard(groupBody, ref, helpers.cardServices);
    }
  }
}
