import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { EntityCreationModal } from "../ui/modals/entity-creation-modal";
import { ENTITY_TAGS, MSG } from "../constants";

/**
 * PM: Create Single Meeting
 * Prompts for a name and optional engagement, then creates a single meeting note.
 */
export function registerCreateSingleMeetingCommand(services: CommandServices, addCommand: AddCommandFn): void {
  addCommand({
    id: "create-single-meeting",
    name: "PM: Create Single Meeting",
    callback: async () => {
      const activeEngagements = services.queryService.getActiveEntitiesByTag(
        ENTITY_TAGS.engagement
      );

      const modal = new EntityCreationModal(
        services.app,
        "New Single Meeting",
        "Meeting name",
        activeEngagements.length > 0 ? "Engagement (optional)" : null,
        activeEngagements
      );

      const result = await modal.prompt();
      if (!result?.name) {
        new Notice(MSG.NO_NAME);
        return;
      }

      try {
        await services.entityService.createSingleMeeting(
          result.name,
          result.parentName ?? undefined
        );
      } catch (err) {
        services.loggerService.error(String(err), "create-single-meeting", err);
        new Notice(`Error creating meeting: ${String(err)}`);
      }
    },
  });
}
