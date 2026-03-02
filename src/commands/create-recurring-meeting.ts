import { Notice } from "obsidian";
import type ProjectManagerPlugin from "../main";
import { EntityCreationModal } from "../ui/modals/entity-creation-modal";
import { ENTITY_TAGS } from "../constants";

/**
 * PM: Create Recurring Meeting
 * Prompts for a name and optional engagement, then creates a recurring meeting note.
 */
export function registerCreateRecurringMeetingCommand(plugin: ProjectManagerPlugin): void {
  plugin.addCommand({
    id: "create-recurring-meeting",
    name: "PM: Create Recurring Meeting",
    callback: async () => {
      const activeEngagements = plugin.queryService.getActiveEntitiesByTag(
        ENTITY_TAGS.engagement
      );

      const modal = new EntityCreationModal(
        plugin.app,
        "New Recurring Meeting",
        "Meeting name",
        activeEngagements.length > 0 ? "Engagement (optional)" : null,
        activeEngagements
      );

      const result = await modal.prompt();
      if (!result?.name) {
        new Notice("No name provided.");
        return;
      }

      try {
        await plugin.entityService.createRecurringMeeting(
          result.name,
          result.parentName ?? undefined
        );
      } catch (err) {
        new Notice(`Error creating recurring meeting: ${String(err)}`);
      }
    },
  });
}
