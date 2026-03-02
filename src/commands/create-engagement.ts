import { Notice } from "obsidian";
import type ProjectManagerPlugin from "../main";
import { EntityCreationModal } from "../ui/modals/entity-creation-modal";
import { ENTITY_TAGS } from "../constants";

/**
 * PM: Create Engagement
 * Prompts for a name and optional active client, then creates an engagement note.
 */
export function registerCreateEngagementCommand(plugin: ProjectManagerPlugin): void {
  plugin.addCommand({
    id: "create-engagement",
    name: "PM: Create Engagement",
    callback: async () => {
      const activeClients = plugin.queryService.getActiveEntitiesByTag(ENTITY_TAGS.client);

      const modal = new EntityCreationModal(
        plugin.app,
        "New Engagement",
        "Engagement name",
        activeClients.length > 0 ? "Client (optional)" : null,
        activeClients
      );

      const result = await modal.prompt();
      if (!result?.name) {
        new Notice("No name provided.");
        return;
      }

      try {
        await plugin.entityService.createEngagement(result.name, result.parentName ?? undefined);
      } catch (err) {
        new Notice(`Error creating engagement: ${String(err)}`);
      }
    },
  });
}
