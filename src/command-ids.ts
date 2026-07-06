/**
 * Single source of truth for this plugin's **bare** command IDs.
 *
 * Consumed by BOTH the registration sites (`addCommand({ id: COMMAND_IDS.X })`)
 * and every dispatch site (`commandExecutor.executeCommandById(COMMAND_IDS.X)`
 * and `ACTION_COMMAND_MAP`), so the registration id and the dispatch id can
 * never drift apart — the exact failure class behind #93.
 *
 * These values are always **bare** (no `manifest.id` prefix). The prefix is
 * applied at dispatch time by `CommandExecutor`, keyed off `manifest.id`, so a
 * plugin rename requires zero changes here or at any call site.
 */
export const COMMAND_IDS = {
  CREATE_CLIENT: "create-client",
  CREATE_ENGAGEMENT: "create-engagement",
  CREATE_PROJECT: "create-project",
  CREATE_PERSON: "create-person",
  CREATE_INBOX: "create-inbox",
  CREATE_SINGLE_MEETING: "create-single-meeting",
  CREATE_RECURRING_MEETING: "create-recurring-meeting",
  CREATE_RECURRING_MEETING_EVENT: "create-recurring-meeting-event",
  CREATE_PROJECT_NOTE: "create-project-note",
  CONVERT_INBOX: "convert-inbox",
  CONVERT_SINGLE_TO_RECURRING: "convert-single-to-recurring",
  SCAFFOLD_VAULT: "scaffold-vault",
  CREATE_RAID_ITEM: "create-raid-item",
  TAG_RAID_REFERENCE: "tag-raid-reference",
  CREATE_REFERENCE_TOPIC: "create-reference-topic",
  UPDATE_REFERENCE_TOPIC: "update-reference-topic",
  CREATE_REFERENCE: "create-reference",
  OPEN_REFERENCE_DASHBOARD: "open-reference-dashboard",
} as const;

export type CommandId = (typeof COMMAND_IDS)[keyof typeof COMMAND_IDS];
