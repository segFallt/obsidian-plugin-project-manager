import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { EntityCreationModal } from "../ui/modals/entity-creation-modal";
import { ENTITY_TAGS, MSG } from "../constants";

/**
 * PM: Create Inbox Note
 * Prompts for a name and optional engagement, then creates an inbox note.
 */
export function registerCreateInboxCommand(services: CommandServices, addCommand: AddCommandFn): void {
  addCommand({
    id: "create-inbox",
    name: "PM: Create Inbox Note",
    callback: async () => {
      const activeEngagements = services.queryService.getActiveEntitiesByTag(
        ENTITY_TAGS.engagement
      );

      const modal = new EntityCreationModal(
        services.app,
        "New Inbox Note",
        "Note name",
        activeEngagements.length > 0 ? "Engagement (optional)" : null,
        activeEngagements
      );

      const result = await modal.prompt();
      if (!result?.name) {
        new Notice(MSG.NO_NAME);
        return;
      }

      try {
        await services.entityService.createInboxNote(
          result.name,
          result.parentName ?? undefined
        );
      } catch (err) {
        services.loggerService.error(String(err), "create-inbox", err);
        new Notice(`Error creating inbox note: ${String(err)}`);
      }
    },
  });
}
