import type { RaidType } from "../../types";
import { CSS_CLS } from "../../constants";

/**
 * Display lookup tables and the render-helper shape shared by the RAID
 * dashboard's view renderers (matrix + item groups).
 */

/** Single-letter abbreviation shown on the RAID type filter chips. */
export const RAID_TYPE_ABBR: Record<RaidType, string> = {
  Risk: "R",
  Assumption: "A",
  Issue: "I",
  Decision: "D",
};

/** Matrix / L×I-dot cell colour class, keyed by `${likelihood}-${impact}`. */
export const MATRIX_CELL_CLASS: Record<string, string> = {
  "High-High": CSS_CLS.RAID_CELL_HH,
  "High-Medium": CSS_CLS.RAID_CELL_HM,
  "High-Low": CSS_CLS.RAID_CELL_HL,
  "Medium-High": CSS_CLS.RAID_CELL_MH,
  "Medium-Medium": CSS_CLS.RAID_CELL_MM,
  "Medium-Low": CSS_CLS.RAID_CELL_ML,
  "Low-High": CSS_CLS.RAID_CELL_LH,
  "Low-Medium": CSS_CLS.RAID_CELL_LM,
  "Low-Low": CSS_CLS.RAID_CELL_LL,
};

/** Status-badge colour class, keyed by RAID status string. */
export const STATUS_CSS: Record<string, string> = {
  "Open": CSS_CLS.RAID_STATUS_OPEN,
  "In Progress": CSS_CLS.RAID_STATUS_IN_PROGRESS,
  "Resolved": CSS_CLS.RAID_STATUS_RESOLVED,
  "Closed": CSS_CLS.RAID_STATUS_CLOSED,
};

/**
 * The RAID view renderers resolve everything they draw from their context (age,
 * initials, links are computed inline), so they need no precomputed lookups.
 * This empty helper type satisfies the shared shell generic without carrying
 * unused state.
 */
export type RaidRenderHelpers = Record<string, never>;
