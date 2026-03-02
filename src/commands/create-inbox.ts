import { Notice } from "obsidian";
import type ProjectManagerPlugin from "../main";
import { EntityCreationModal } from "../ui/modals/entity-creation-modal";
import { ENTITY_TAGS } from "../constants";

/**
 * PM: Create Inbox Note
 * Prompts for a name and optional engagement, then creates an inbox note.
 */
export function registerCreateInboxCommand(plugin: ProjectManagerPlugin): void {
  plugin.addCommand({
    id: "create-inbox",
    name: "PM: Create Inbox Note",
    callback: async () => {
      const activeEngagements = plugin.queryService.getActiveEntitiesByTag(
        ENTITY_TAGS.engagement
      );

      const modal = new EntityCreationModal(
        plugin.app,
        "New Inbox Note",
        "Note name",
        activeEngagements.length > 0 ? "Engagement (optional)" : null,
        activeEngagements
      );

      const result = await modal.prompt();
      if (!result?.name) {
        new Notice("No name provided.");
        return;
      }

      try {
        await plugin.entityService.createInboxNote(
          result.name,
          result.parentName ?? undefined
        );
      } catch (err) {
        new Notice(`Error creating inbox note: ${String(err)}`);
      }
    },
  });
}
