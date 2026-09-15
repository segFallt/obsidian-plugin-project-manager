import type { DataviewPage, ReferenceFilters } from "../../types";
import type { IEntityHierarchyService } from "../../services/interfaces";
import { REFERENCE_VIEW_MODE } from "../../constants";
import type { IViewRenderer } from "../view-renderer";
import { TopicViewRenderer } from "./topic-view-renderer";
import { FlatGroupedViewRenderer } from "./flat-grouped-view";
import type { RefRenderHelpers } from "./reference-card-renderer";

export type { RefRenderHelpers, CardNavigationServices } from "./reference-card-renderer";
export { TopicViewRenderer } from "./topic-view-renderer";
export { FlatGroupedViewRenderer } from "./flat-grouped-view";

/** Dependencies the reference view renderers capture (entity name resolution). */
export interface ReferenceViewDeps {
  hierarchyService: IEntityHierarchyService;
}

/** A view-mode-keyed set of reference renderers, ready for the shell's `views` map. */
export type ReferenceViewSet = Record<
  string,
  IViewRenderer<DataviewPage, RefRenderHelpers, ReferenceFilters>
>;

/**
 * Builds the References dashboard's renderer set: the topic-tree view plus the
 * two flat grouped views (client / engagement), which share
 * {@link FlatGroupedViewRenderer} — differing only in the name each resolves.
 */
export function buildReferenceViews(deps: ReferenceViewDeps): ReferenceViewSet {
  return {
    [REFERENCE_VIEW_MODE.TOPIC]: new TopicViewRenderer(),
    [REFERENCE_VIEW_MODE.CLIENT]: new FlatGroupedViewRenderer(
      REFERENCE_VIEW_MODE.CLIENT,
      (ref) => deps.hierarchyService.resolveClientName(ref)
    ),
    [REFERENCE_VIEW_MODE.ENGAGEMENT]: new FlatGroupedViewRenderer(
      REFERENCE_VIEW_MODE.ENGAGEMENT,
      (ref) => deps.hierarchyService.resolveEngagementName(ref)
    ),
  };
}
