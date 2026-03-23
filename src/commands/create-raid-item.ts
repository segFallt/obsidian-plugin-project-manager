import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { InputModal } from "../ui/modals/input-modal";
import { SuggesterModal } from "../ui/modals/suggester-modal";
import type { DataviewPage, RaidType } from "../types";
import { ENTITY_TAGS, MSG, LOG_CONTEXT } from "../constants";
import { normalizeToName } from "../utils/link-utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const RAID_TYPES: RaidType[] = ["Risk", "Assumption", "Issue", "Decision"];

// Sentinel used as a list item for "no selection" in optional pickers
const NONE_OPTION = { file: { name: "(None)", path: "" } } as DataviewPage;

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
    id: "create-raid-item",
    name: "PM: Create RAID Item",
    callback: async () => {
      services.actionContext.consume();
      services.loggerService.debug("create-raid-item: command started", LOG_CONTEXT.CREATE_RAID_ITEM);

      // Step 1 — name
      const nameModal = new InputModal(services.app, "RAID item name");
      const name = await nameModal.prompt();
      if (!name) {
        services.loggerService.warn("create-raid-item: cancelled", LOG_CONTEXT.CREATE_RAID_ITEM);
        new Notice(MSG.CANCELLED);
        return;
      }
      services.loggerService.debug(`create-raid-item: step 1 complete, name: "${name}"`, LOG_CONTEXT.CREATE_RAID_ITEM);

      // Step 2 — RAID type
      const typeModal = new SuggesterModal<RaidType>(services.app, RAID_TYPES, (t) => t);
      const raidType = await typeModal.choose();
      if (!raidType) {
        services.loggerService.warn("create-raid-item: cancelled", LOG_CONTEXT.CREATE_RAID_ITEM);
        new Notice(MSG.CANCELLED);
        return;
      }
      services.loggerService.debug(`create-raid-item: step 2 complete, type: "${raidType}"`, LOG_CONTEXT.CREATE_RAID_ITEM);

      // Step 3 — optional engagement
      const engagements = services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.engagement);
      const engagementModal = new SuggesterModal<DataviewPage>(
        services.app,
        [NONE_OPTION, ...engagements],
        (e) => {
          if (e.file.path === "") return "(None)";
          const clientName = normalizeToName(e.client);
          return clientName ? `${e.file.name} (${clientName})` : e.file.name;
        },
        "Engagement (optional)"
      );
      const selectedEngagement = await engagementModal.choose();
      if (selectedEngagement === null) {
        services.loggerService.warn("create-raid-item: cancelled", LOG_CONTEXT.CREATE_RAID_ITEM);
        new Notice(MSG.CANCELLED);
        return;
      }
      const engagementName = selectedEngagement.file.path === "" ? undefined : selectedEngagement.file.name;
      services.loggerService.debug(`create-raid-item: step 3 complete, engagement: "${engagementName ?? "(none)"}"`, LOG_CONTEXT.CREATE_RAID_ITEM);

      // Step 4 — optional owner
      const owners = services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.person);
      const ownerModal = new SuggesterModal<DataviewPage>(
        services.app,
        [NONE_OPTION, ...owners],
        (o) => {
          if (o.file.path === "") return "(None)";
          const clientName = normalizeToName(o.client);
          return clientName ? `${o.file.name} (${clientName})` : o.file.name;
        },
        "Owner (optional)"
      );
      const selectedOwner = await ownerModal.choose();
      if (selectedOwner === null) {
        services.loggerService.warn("create-raid-item: cancelled", LOG_CONTEXT.CREATE_RAID_ITEM);
        new Notice(MSG.CANCELLED);
        return;
      }
      const ownerName = selectedOwner.file.path === "" ? undefined : selectedOwner.file.name;
      services.loggerService.debug(`create-raid-item: step 4 complete, owner: "${ownerName ?? "(none)"}"`, LOG_CONTEXT.CREATE_RAID_ITEM);

      services.loggerService.debug(
        `create-raid-item: name: "${name}", type: "${raidType}", engagement: "${engagementName ?? "none"}", owner: "${ownerName ?? "none"}"`,
        LOG_CONTEXT.CREATE_RAID_ITEM
      );

      try {
        await services.entityService.createRaidItem(name, raidType, engagementName, ownerName);
      } catch (err) {
        services.loggerService.error(String(err), LOG_CONTEXT.CREATE_RAID_ITEM, err);
        new Notice(`Error creating RAID item: ${String(err)}`);
      }
    },
  });
}
