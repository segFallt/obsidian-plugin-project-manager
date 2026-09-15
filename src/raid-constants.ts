import type { RaidType, RaidDirection, RaidStatus, RaidLikelihood, RaidImpact } from "./types";

// ─── Shared RAID vocabulary ─────────────────────────────────────────────────
//
// The single source of truth for RAID enumerations, consumed by the dashboard,
// field config, badge processor, and create command.

/** The four RAID item types, in canonical display order. */
export const RAID_TYPES: RaidType[] = ["Risk", "Assumption", "Issue", "Decision"];

/** The RAID item statuses, in lifecycle order. */
export const RAID_STATUSES: RaidStatus[] = ["Open", "In Progress", "Resolved", "Closed"];

/** Statuses a fresh dashboard shows by default (the still-active ones). */
export const RAID_DEFAULT_ACTIVE_STATUSES: RaidStatus[] = ["Open", "In Progress"];

/** Likelihood levels, high→low — the order used at every site (matrix rows and field config agree). */
export const LIKELIHOODS: RaidLikelihood[] = ["High", "Medium", "Low"];

/**
 * Impact levels, low→high — the pm-raid-dashboard matrix column order.
 * Impact ordering is deliberately site-specific: the matrix reads columns
 * low→high, while the entity-field-config select lists them severity-first
 * (see {@link IMPACTS_SEVERITY_FIRST}).
 */
export const IMPACTS: RaidImpact[] = ["Low", "Medium", "High"];

/** Impact levels, high→low (severity-first) — the entity-field-config select order. */
export const IMPACTS_SEVERITY_FIRST: RaidImpact[] = ["High", "Medium", "Low"];

// ─── Shared RAID direction constants ────────────────────────────────────────

export const DIRECTION_LABELS: Record<RaidDirection, Record<RaidType, string>> = {
  positive: { Risk: "Mitigates", Assumption: "Validates", Issue: "Resolves", Decision: "Supports" },
  negative: { Risk: "Escalates", Assumption: "Invalidates", Issue: "Compounds", Decision: "Challenges" },
  neutral:  { Risk: "Notes",     Assumption: "Notes",       Issue: "Notes",    Decision: "Notes" },
};

export const DIRECTION_ICONS: Record<RaidDirection, string> = {
  positive: "↑",
  negative: "↓",
  neutral:  "·",
};

// Fallback used when a note's `raid-type` frontmatter is missing or unrecognised.
export const DEFAULT_RAID_TYPE: RaidType = "Decision";

// Fallback label used when a direction/type lookup in DIRECTION_LABELS misses.
// Semantically identical to the neutral-direction label value ("Notes").
export const DEFAULT_DIRECTION_LABEL = "Notes";

// ─── Shared RAID reference parsing constants ────────────────────────────────

/**
 * Matches an ATX heading line, capturing the leading `#` run in group 1 so the
 * heading level can be derived from `match[1].length`. Non-global on purpose so
 * `.exec`/`.test` can be shared safely without `lastIndex` carrying over.
 */
export const ATX_HEADING_RE = /^(#{1,6})\s+/;

/**
 * Scope discriminator tags for a captured RAID reference entry. `LINE`/`SECTION`
 * are typed as the string literals `"line"`/`"section"`, so they assign to and
 * compare against the discriminated `RaidReferenceEntry` union without widening.
 */
export const RAID_SCOPE = { LINE: "line", SECTION: "section" } as const;

/** Inline RAID badge annotation keyword: `{raid:<direction>}[[Item]]`. */
export const RAID_BADGE_KEYWORD = "raid";

/** Builds the inline RAID badge annotation: `{raid:<direction>}[[<itemName>]]`. */
export function formatRaidBadge(direction: RaidDirection, itemName: string): string {
  return `{${RAID_BADGE_KEYWORD}:${direction}}[[${itemName}]]`;
}
