import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { InputModal } from "../ui/modals/input-modal";
import { SuggesterModal } from "../ui/modals/suggester-modal";
import type { DataviewPage, RaidType } from "../types";
import { MSG, LOG_CONTEXT } from "../constants";

const RAID_TYPES: RaidType[] = ["Risk", "Assumption", "Issue", "Decision"];

/**
 * PM: Create RAID Item
 * Prompts sequentially for:
 *   1. Name (InputModal)
 *   2. RAID Type (SuggesterModal)
 *   3. Engagement (SuggesterModal, optional)
 *   4. Owner (SuggesterModal, optional)
 *
 * Then creates a RAID item note via entityService.createRaidItem().
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

      // Step 1: Name
      const nameModal = new InputModal(services.app, "RAID item name", "e.g. Risk of scope creep");
      const name = await nameModal.prompt();
      if (!name) {
        services.loggerService.warn("create-raid-item: cancelled at step 1 (no name provided)", LOG_CONTEXT.CREATE_RAID_ITEM);
        new Notice(MSG.NO_NAME);
        return;
      }
      services.loggerService.debug(`create-raid-item: step 1 complete — name: "${name}"`, LOG_CONTEXT.CREATE_RAID_ITEM);

      // Step 2: RAID Type
      const typeModal = new SuggesterModal<RaidType>(
        services.app,
        RAID_TYPES,
        (t) => t,
        "Select RAID type"
      );
      const raidType = await typeModal.choose();
      if (!raidType) {
        services.loggerService.warn("create-raid-item: cancelled at step 2 (RAID type selection dismissed)", LOG_CONTEXT.CREATE_RAID_ITEM);
        new Notice('RAID item creation cancelled.');
        return;
      }
      services.loggerService.debug(`create-raid-item: step 2 complete — type: "${raidType}"`, LOG_CONTEXT.CREATE_RAID_ITEM);

      // Step 3: Engagement (optional)
      const NONE_SENTINEL = "(None)";
      const activeEngagements = services.queryService.getActiveEntitiesByTag("#engagement");
      const engagementOptions: Array<DataviewPage | typeof NONE_SENTINEL> = [
        NONE_SENTINEL,
        ...activeEngagements,
      ];
      const engagementModal = new SuggesterModal<DataviewPage | typeof NONE_SENTINEL>(
        services.app,
        engagementOptions,
        (item) => (item === NONE_SENTINEL ? NONE_SENTINEL : item.file.name),
        "Select engagement (optional)"
      );
      const selectedEngagement = await engagementModal.choose();
      if (selectedEngagement === null) {
        services.loggerService.warn("create-raid-item: cancelled at step 3 (engagement selection dismissed)", LOG_CONTEXT.CREATE_RAID_ITEM);
        new Notice('RAID item creation cancelled.');
        return;
      }
      const engagementName =
        selectedEngagement === NONE_SENTINEL
          ? undefined
          : selectedEngagement.file.name;
      services.loggerService.debug(`create-raid-item: step 3 complete — engagement: "${engagementName ?? "none"}"`, LOG_CONTEXT.CREATE_RAID_ITEM);

      // Step 4: Owner (optional)
      const activePeople = services.queryService.getActiveEntitiesByTag("#person");
      const ownerOptions: Array<DataviewPage | typeof NONE_SENTINEL> = [
        NONE_SENTINEL,
        ...activePeople,
      ];
      const ownerModal = new SuggesterModal<DataviewPage | typeof NONE_SENTINEL>(
        services.app,
        ownerOptions,
        (item) => (item === NONE_SENTINEL ? NONE_SENTINEL : item.file.name),
        "Select owner (optional)"
      );
      const selectedOwner = await ownerModal.choose();
      if (selectedOwner === null) {
        services.loggerService.warn("create-raid-item: cancelled at step 4 (owner selection dismissed)", LOG_CONTEXT.CREATE_RAID_ITEM);
        new Notice('RAID item creation cancelled.');
        return;
      }
      const ownerName =
        selectedOwner === NONE_SENTINEL
          ? undefined
          : selectedOwner.file.name;
      services.loggerService.debug(`create-raid-item: step 4 complete — owner: "${ownerName ?? "none"}"`, LOG_CONTEXT.CREATE_RAID_ITEM);

      services.loggerService.debug(
        `create-raid-item invoked: "${name}", type: "${raidType}", engagement: "${engagementName ?? "none"}", owner: "${ownerName ?? "none"}"`,
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
