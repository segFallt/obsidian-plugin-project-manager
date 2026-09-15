import type { DataviewPage, RaidDashboardFilters } from "../../types";
import { RAID_VIEW_MODE, RAID_FACET_KEY } from "../../constants";
import type { RaidRenderHelpers } from "./raid-view-constants";
import { RaidMatrixRenderer } from "./raid-matrix-renderer";
import { RaidItemGroupRenderer } from "./raid-item-group-renderer";
import type { IViewRenderer, ViewRenderContext } from "../view-renderer";

/**
 * The RAID dashboard's single shell-dispatched view: a thin composite that
 * draws the interactive matrix and then the count strip + grouped tables in one
 * pass (RAID has no view-mode tabs). It declares `ownsFacet = "matrixCell"` so
 * the shell supplies `ctx.facetItems`, which it forwards — via the shared ctx —
 * to the matrix renderer for its excluded-facet cell counts.
 */
export class RaidDashboardRenderer
  implements IViewRenderer<DataviewPage, RaidRenderHelpers, RaidDashboardFilters>
{
  readonly mode = RAID_VIEW_MODE.MATRIX;
  readonly ownsFacet = RAID_FACET_KEY.MATRIX_CELL;

  constructor(
    private readonly matrixRenderer: RaidMatrixRenderer = new RaidMatrixRenderer(),
    private readonly itemGroupRenderer: RaidItemGroupRenderer = new RaidItemGroupRenderer()
  ) {}

  render(ctx: ViewRenderContext<DataviewPage, RaidRenderHelpers, RaidDashboardFilters>): void {
    this.matrixRenderer.render(ctx);
    this.itemGroupRenderer.render(ctx);
  }
}
