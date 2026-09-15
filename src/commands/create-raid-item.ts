import { Notice } from "obsidian";
import { COMMAND_IDS } from "../command-ids";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { InputModal } from "../ui/modals/input-modal";
import { SuggesterModal } from "../ui/modals/suggester-modal";
import type { DataviewPage, RaidType } from "../types";
import {
  ENTITY_TAGS,
  MSG,
  LOG_CONTEXT,
  SELECT_NONE_LABEL,
  COMMAND_NAMES,
  CMD_MODAL,
  PARENT_LABEL,
  RAID_PICKER_NONE_LABEL,
  CMD_ERROR_LABEL,
} from "../constants";
import { normalizeToName } from "../utils/link-utils";
import { withCommandErrorNotice } from "./command-error-notice";

// ─── Constants ────────────────────────────────────────────────────────────────

const RAID_TYPES: RaidType[] = ["Risk", "Assumption", "Issue", "Decision"];

// Sentinel used as a list item for "no selection" in optional pickers
const NONE_OPTION = { file: { name: RAID_PICKER_NONE_LABEL, path: "" } } as DataviewPage;

/**
 * PM: Create RAID Item
 *
 * Sequential modal flow:
 *   1. InputModal       — RAID item name
 *   2. SuggesterModal   — RAID type (Risk / Assumption / Issue / Decision)
 *   3. SuggesterModal   — optional engagement (includes a "(None)" item)
 *   4. SuggesterModal   — optional owner       (includes a "(None)" item)
 */
export function registerCreateRaidItemCommand(
  services: CommandServices,
  addCommand: AddCommandFn
): void {
  addCommand({
    id: COMMAND_IDS.CREATE_RAID_ITEM,
    name: COMMAND_NAMES.CREATE_RAID_ITEM,
    callback: async () => {
      services.actionContext.consume();
      services.loggerService.debug(`${LOG_CONTEXT.CREATE_RAID_ITEM}: command started`, LOG_CONTEXT.CREATE_RAID_ITEM);

      // Step 1 — name
      const nameModal = new InputModal(services.app, CMD_MODAL.CREATE_RAID_ITEM.title);
      const name = await nameModal.prompt();
      if (!name) {
        services.loggerService.warn(`${LOG_CONTEXT.CREATE_RAID_ITEM}: cancelled`, LOG_CONTEXT.CREATE_RAID_ITEM);
        new Notice(MSG.CANCELLED);
        return;
      }
      services.loggerService.debug(`${LOG_CONTEXT.CREATE_RAID_ITEM}: step 1 complete, name: "${name}"`, LOG_CONTEXT.CREATE_RAID_ITEM);

      // Step 2 — RAID type
      const typeModal = new SuggesterModal<RaidType>(services.app, RAID_TYPES, (t) => t);
      const raidType = await typeModal.choose();
      if (!raidType) {
        services.loggerService.warn(`${LOG_CONTEXT.CREATE_RAID_ITEM}: cancelled`, LOG_CONTEXT.CREATE_RAID_ITEM);
        new Notice(MSG.CANCELLED);
        return;
      }
      services.loggerService.debug(`${LOG_CONTEXT.CREATE_RAID_ITEM}: step 2 complete, type: "${raidType}"`, LOG_CONTEXT.CREATE_RAID_ITEM);

      // Step 3 — optional engagement
      const engagements = services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.engagement);
      const engagementModal = new SuggesterModal<DataviewPage>(
        services.app,
        [NONE_OPTION, ...engagements],
        (e) => {
          if (e.file.path === "") return RAID_PICKER_NONE_LABEL;
          const clientName = normalizeToName(e.client);
          return clientName ? `${e.file.name} (${clientName})` : e.file.name;
        },
        PARENT_LABEL.ENGAGEMENT_OPTIONAL
      );
      const selectedEngagement = await engagementModal.choose();
      if (selectedEngagement === null) {
        services.loggerService.warn(`${LOG_CONTEXT.CREATE_RAID_ITEM}: cancelled`, LOG_CONTEXT.CREATE_RAID_ITEM);
        new Notice(MSG.CANCELLED);
        return;
      }
      const engagementName = selectedEngagement.file.path === "" ? undefined : selectedEngagement.file.name;
      services.loggerService.debug(`${LOG_CONTEXT.CREATE_RAID_ITEM}: step 3 complete, engagement: "${engagementName ?? SELECT_NONE_LABEL}"`, LOG_CONTEXT.CREATE_RAID_ITEM);

      // Step 4 — optional owner
      const owners = services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.person);
      const ownerModal = new SuggesterModal<DataviewPage>(
        services.app,
        [NONE_OPTION, ...owners],
        (o) => {
          if (o.file.path === "") return RAID_PICKER_NONE_LABEL;
          const clientName = normalizeToName(o.client);
          return clientName ? `${o.file.name} (${clientName})` : o.file.name;
        },
        PARENT_LABEL.OWNER_OPTIONAL
      );
      const selectedOwner = await ownerModal.choose();
      if (selectedOwner === null) {
        services.loggerService.warn(`${LOG_CONTEXT.CREATE_RAID_ITEM}: cancelled`, LOG_CONTEXT.CREATE_RAID_ITEM);
        new Notice(MSG.CANCELLED);
        return;
      }
      const ownerName = selectedOwner.file.path === "" ? undefined : selectedOwner.file.name;
      services.loggerService.debug(`${LOG_CONTEXT.CREATE_RAID_ITEM}: step 4 complete, owner: "${ownerName ?? SELECT_NONE_LABEL}"`, LOG_CONTEXT.CREATE_RAID_ITEM);

      services.loggerService.debug(
        `${LOG_CONTEXT.CREATE_RAID_ITEM}: name: "${name}", type: "${raidType}", engagement: "${engagementName ?? "none"}", owner: "${ownerName ?? "none"}"`,
        LOG_CONTEXT.CREATE_RAID_ITEM
      );

      await withCommandErrorNotice(
        services.loggerService,
        LOG_CONTEXT.CREATE_RAID_ITEM,
        (err) => `${CMD_ERROR_LABEL.CREATE_RAID_ITEM}: ${String(err)}`,
        () => services.entityService.createRaidItem(name, raidType, engagementName, ownerName)
      );
    },
  });
}
