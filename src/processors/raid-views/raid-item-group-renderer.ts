import type { DataviewPage, RaidDashboardFilters, RaidLikelihood, RaidImpact } from "../../types";
import { HTML_TAG, CSS_CLS, JS_TYPE, MS_PER_DAY, FM_KEY, RAID_VIEW_MODE, RAID_DASHBOARD_TEXT } from "../../constants";
import { RAID_TYPES } from "../../raid-constants";
import { MATRIX_CELL_CLASS, STATUS_CSS } from "./raid-view-constants";
import type { RaidRenderHelpers } from "./raid-view-constants";
import { createInternalLink } from "../dom-helpers";
import { normalizeToName } from "../../utils/link-utils";
import type { IViewRenderer, ViewRenderContext } from "../view-renderer";

type RaidGroupCtx = ViewRenderContext<DataviewPage, RaidRenderHelpers, RaidDashboardFilters>;

/** The Dataview DateTime field holding a millisecond timestamp. */
const DATAVIEW_TS_FIELD = "ts";

/** Max initials shown in an owner avatar. */
const MAX_OWNER_INITIALS = 2;

/** Whether a value is a Dataview DateTime object carrying a millisecond `ts`. */
function isDataviewDateTime(value: unknown): value is Record<string, number> {
  return typeof value === JS_TYPE.OBJECT && value !== null && DATAVIEW_TS_FIELD in (value as object);
}

/** Whole days since the raised-date, or null when it is absent or unparseable. */
function ageInDays(raisedRaw: unknown): number | null {
  if (!raisedRaw) return null;
  const raisedMs = isDataviewDateTime(raisedRaw)
    ? raisedRaw[DATAVIEW_TS_FIELD]
    : new Date(String(raisedRaw)).getTime();
  const days = Math.floor((Date.now() - raisedMs) / MS_PER_DAY);
  return isNaN(days) ? null : days;
}

/** The uppercase initials (up to two) for an owner name. */
function ownerInitials(ownerName: string): string {
  return ownerName
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, MAX_OWNER_INITIALS)
    .join("");
}

/**
 * Passive {@link IViewRenderer} for the RAID dashboard body below the matrix:
 * a per-type count strip and one table per non-empty RAID type. It reads only
 * the filtered `ctx.items` and renders — no filtering, no query access.
 */
export class RaidItemGroupRenderer
  implements IViewRenderer<DataviewPage, RaidRenderHelpers, RaidDashboardFilters>
{
  // Composed by RaidDashboardRenderer, not registered in the shell's views map;
  // `mode` is nominal (required by IViewRenderer, never dispatched on).
  readonly mode = RAID_VIEW_MODE.MATRIX;

  render(ctx: RaidGroupCtx): void {
    this.renderCountStrip(ctx.container, ctx.items);
    this.renderItemGroups(ctx.container, ctx.items);
  }

  private renderCountStrip(container: HTMLElement, items: DataviewPage[]): void {
    const strip = container.createDiv({ cls: CSS_CLS.RAID_DASHBOARD_COUNTS });
    const counts = RAID_TYPES.map((raidType) => {
      const n = items.filter((item) => String(item[FM_KEY.RAID_TYPE] ?? "") === raidType).length;
      return RAID_DASHBOARD_TEXT.typeCount(raidType, n);
    });
    strip.textContent = counts.join(RAID_DASHBOARD_TEXT.COUNT_SEPARATOR);
  }

  private renderItemGroups(container: HTMLElement, items: DataviewPage[]): void {
    for (const raidType of RAID_TYPES) {
      const groupItems = items.filter((item) => String(item[FM_KEY.RAID_TYPE] ?? "") === raidType);
      if (groupItems.length === 0) continue;

      const section = container.createDiv({ cls: CSS_CLS.RAID_DASHBOARD_SECTION });
      section.createEl(HTML_TAG.H4, {
        cls: CSS_CLS.RAID_SECTION_HEADER,
        text: RAID_DASHBOARD_TEXT.sectionTitle(raidType),
      });

      const table = section.createEl(HTML_TAG.TABLE, { cls: CSS_CLS.RAID_ITEM_TABLE });
      const headerRow = table.createEl(HTML_TAG.THEAD).createEl(HTML_TAG.TR);
      for (const header of RAID_DASHBOARD_TEXT.ITEM_TABLE_HEADERS) {
        headerRow.createEl(HTML_TAG.TH, { text: header });
      }

      const tbody = table.createEl(HTML_TAG.TBODY);
      for (const item of groupItems) {
        this.renderItemRow(tbody, item);
      }
    }
  }

  private renderItemRow(tbody: HTMLElement, item: DataviewPage): void {
    const row = tbody.createEl(HTML_TAG.TR, { cls: CSS_CLS.RAID_ITEM_ROW });

    // Title (internal link)
    createInternalLink(row.createEl(HTML_TAG.TD), item.file.path, item.file.name);

    // Status badge
    const status = String(item[FM_KEY.STATUS] ?? "");
    row.createEl(HTML_TAG.TD).createSpan({
      cls: `${CSS_CLS.RAID_STATUS_BADGE} ${STATUS_CSS[status] ?? ""}`,
      text: status,
    });

    // L×I coloured dot
    const likelihood = String(item[FM_KEY.LIKELIHOOD] ?? "") as RaidLikelihood;
    const impact = String(item[FM_KEY.IMPACT] ?? "") as RaidImpact;
    row.createEl(HTML_TAG.TD).createSpan({
      cls: `${CSS_CLS.RAID_LXI_DOT} ${MATRIX_CELL_CLASS[`${likelihood}-${impact}`] ?? ""}`,
      text: RAID_DASHBOARD_TEXT.lxiLabel(likelihood, impact),
    });

    // Age (days since raised-date)
    const ageCell = row.createEl(HTML_TAG.TD);
    const days = ageInDays(item[FM_KEY.RAISED_DATE]);
    if (days !== null) {
      ageCell.createSpan({ cls: CSS_CLS.RAID_AGE_PILL, text: RAID_DASHBOARD_TEXT.agePill(days) });
    }

    // Owner initials avatar
    const ownerCell = row.createEl(HTML_TAG.TD);
    const ownerName = normalizeToName(item[FM_KEY.OWNER]) ?? "";
    if (ownerName) {
      ownerCell.createSpan({
        cls: CSS_CLS.RAID_OWNER_AVATAR,
        text: ownerInitials(ownerName),
        attr: { title: ownerName },
      });
    }
  }
}
