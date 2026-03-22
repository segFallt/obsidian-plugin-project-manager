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
