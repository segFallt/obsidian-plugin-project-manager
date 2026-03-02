import { Notice } from "obsidian";
import type ProjectManagerPlugin from "../main";
import { EntityCreationModal } from "../ui/modals/entity-creation-modal";
import { ENTITY_TAGS } from "../constants";

/**
 * PM: Create Single Meeting
 * Prompts for a name and optional engagement, then creates a single meeting note.
 */
export function registerCreateSingleMeetingCommand(plugin: ProjectManagerPlugin): void {
  plugin.addCommand({
    id: "create-single-meeting",
    name: "PM: Create Single Meeting",
    callback: async () => {
      const activeEngagements = plugin.queryService.getActiveEntitiesByTag(
        ENTITY_TAGS.engagement
      );

      const modal = new EntityCreationModal(
        plugin.app,
        "New Single Meeting",
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
        await plugin.entityService.createSingleMeeting(
          result.name,
          result.parentName ?? undefined
        );
      } catch (err) {
        new Notice(`Error creating meeting: ${String(err)}`);
      }
    },
  });
}
