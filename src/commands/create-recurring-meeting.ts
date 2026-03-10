import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { EntityCreationModal } from "../ui/modals/entity-creation-modal";
import { ENTITY_TAGS, MSG } from "../constants";

/**
 * PM: Create Recurring Meeting
 * Prompts for a name and optional engagement, then creates a recurring meeting note.
 */
export function registerCreateRecurringMeetingCommand(services: CommandServices, addCommand: AddCommandFn): void {
  addCommand({
    id: "create-recurring-meeting",
    name: "PM: Create Recurring Meeting",
    callback: async () => {
      const activeEngagements = services.queryService.getActiveEntitiesByTag(
        ENTITY_TAGS.engagement
      );

      const modal = new EntityCreationModal(
        services.app,
        "New Recurring Meeting",
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
        await services.entityService.createRecurringMeeting(
          result.name,
          result.parentName ?? undefined
        );
      } catch (err) {
        services.loggerService.error(String(err), "create-recurring-meeting", err);
        new Notice(`Error creating recurring meeting: ${String(err)}`);
      }
    },
  });
}
