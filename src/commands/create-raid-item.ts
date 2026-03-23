import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { RaidItemCreationModal } from "../ui/modals/raid-item-creation-modal";
import { ENTITY_TAGS, MSG, LOG_CONTEXT } from "../constants";

/**
 * PM: Create RAID Item
 * Opens a compound modal collecting name, RAID type, optional engagement, and optional owner,
 * then creates a RAID item note via entityService.createRaidItem().
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

      const engagements = services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.engagement);
      const owners = services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.person);

      const modal = new RaidItemCreationModal(services.app, engagements, owners);
      const result = await modal.prompt();

      if (!result) {
        services.loggerService.warn("create-raid-item: cancelled", LOG_CONTEXT.CREATE_RAID_ITEM);
        new Notice(MSG.CANCELLED);
        return;
      }

      services.loggerService.debug(
        `create-raid-item: name: "${result.name}", type: "${result.raidType}", engagement: "${result.engagementName ?? "none"}", owner: "${result.ownerName ?? "none"}"`,
        LOG_CONTEXT.CREATE_RAID_ITEM
      );

      try {
        await services.entityService.createRaidItem(
          result.name,
          result.raidType,
          result.engagementName,
          result.ownerName
        );
      } catch (err) {
        services.loggerService.error(String(err), LOG_CONTEXT.CREATE_RAID_ITEM, err);
        new Notice(`Error creating RAID item: ${String(err)}`);
      }
    },
  });
}
