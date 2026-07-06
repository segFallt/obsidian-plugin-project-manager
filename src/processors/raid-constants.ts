import type { RaidType, RaidDirection } from "../types";

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
