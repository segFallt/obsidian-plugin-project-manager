import type { DataviewPage, RaidDashboardFilters, RaidLikelihood, RaidImpact } from "../../types";
import { HTML_TAG, CSS_CLS, DOM_EVENT, FM_KEY, RAID_VIEW_MODE, RAID_FACET_KEY, RAID_DASHBOARD_TEXT } from "../../constants";
import { LIKELIHOODS, IMPACTS } from "../../raid-constants";
import { MATRIX_CELL_CLASS } from "./raid-view-constants";
import type { RaidRenderHelpers } from "./raid-view-constants";
import type { IViewRenderer, ViewRenderContext } from "../view-renderer";

type RaidMatrixCtx = ViewRenderContext<DataviewPage, RaidRenderHelpers, RaidDashboardFilters>;

/** Counts items sitting in the given likelihood×impact cell. */
function cellCount(items: DataviewPage[], likelihood: RaidLikelihood, impact: RaidImpact): number {
  return items.filter(
    (item) =>
      String(item[FM_KEY.LIKELIHOOD] ?? "") === likelihood && String(item[FM_KEY.IMPACT] ?? "") === impact
  ).length;
}

/**
 * The RAID likelihood×impact matrix: an interactive but read-pure
 * {@link IViewRenderer}. It draws the L×I grid and doubles as a filter control —
 * a cell click emits `onFilterChange({ matrixCell })` rather than mutating state.
 *
 * It declares `ownsFacet = "matrixCell"`, so the shell hands it `ctx.facetItems`
 * (the set filtered by every facet except the matrix cell). Cell counts read
 * from that set, so a selected cell keeps the other cells' counts.
 */
export class RaidMatrixRenderer
  implements IViewRenderer<DataviewPage, RaidRenderHelpers, RaidDashboardFilters>
{
  // Composed by RaidDashboardRenderer (not registered in the shell's views map
  // directly); `mode` is nominal, `ownsFacet` documents the driven facet.
  readonly mode = RAID_VIEW_MODE.MATRIX;
  readonly ownsFacet = RAID_FACET_KEY.MATRIX_CELL;

  render(ctx: RaidMatrixCtx): void {
    // Counts ignore this renderer's own facet (matrix cell) so selecting a cell
    // does not zero the others; falls back to the filtered set when unset.
    const countItems = ctx.facetItems ?? ctx.items;
    const selectedCell = ctx.filters.matrixCell;

    const wrapper = ctx.container.createDiv({ cls: CSS_CLS.RAID_MATRIX_WRAPPER });
    wrapper.createEl(HTML_TAG.H5, { cls: CSS_CLS.RAID_SECTION_HEADER, text: RAID_DASHBOARD_TEXT.MATRIX_HEADING });

    const grid = wrapper.createDiv({ cls: CSS_CLS.RAID_MATRIX });
    const headerCellCls = `${CSS_CLS.RAID_MATRIX_CELL} ${CSS_CLS.RAID_MATRIX_CELL_HEADER}`;

    // Top-left empty corner, then the impact column headers (low→high).
    grid.createDiv({ cls: headerCellCls });
    for (const impact of IMPACTS) {
      grid.createDiv({ cls: headerCellCls, text: impact });
    }

    // One row per likelihood (high→low), each led by a row header.
    for (const likelihood of LIKELIHOODS) {
      grid.createDiv({ cls: headerCellCls, text: likelihood });

      for (const impact of IMPACTS) {
        const colourClass = MATRIX_CELL_CLASS[`${likelihood}-${impact}`] ?? "";
        const isActive = selectedCell?.likelihood === likelihood && selectedCell?.impact === impact;
        const selectedClass = isActive ? ` ${CSS_CLS.RAID_MATRIX_CELL_SELECTED}` : "";

        const cell = grid.createDiv({
          cls: `${CSS_CLS.RAID_MATRIX_CELL} ${colourClass}${selectedClass}`,
          text: String(cellCount(countItems, likelihood, impact)),
        });

        cell.addEventListener(DOM_EVENT.CLICK, () => {
          ctx.onFilterChange({ matrixCell: isActive ? null : { likelihood, impact } });
        });
      }
    }
  }
}
