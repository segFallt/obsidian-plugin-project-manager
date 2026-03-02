import { Notice } from "obsidian";
import type ProjectManagerPlugin from "../main";
import { EntityCreationModal } from "../ui/modals/entity-creation-modal";
import { ENTITY_TAGS } from "../constants";

/**
 * PM: Create Person
 * Prompts for a name and optional active client, then creates a person note.
 */
export function registerCreatePersonCommand(plugin: ProjectManagerPlugin): void {
  plugin.addCommand({
    id: "create-person",
    name: "PM: Create Person",
    callback: async () => {
      const activeClients = plugin.queryService.getActiveEntitiesByTag(ENTITY_TAGS.client);

      const modal = new EntityCreationModal(
        plugin.app,
        "New Person",
        "Person name",
        activeClients.length > 0 ? "Client (optional)" : null,
        activeClients
      );

      const result = await modal.prompt();
      if (!result?.name) {
        new Notice("No name provided.");
        return;
      }

      try {
        await plugin.entityService.createPerson(result.name, result.parentName ?? undefined);
      } catch (err) {
        new Notice(`Error creating person: ${String(err)}`);
      }
    },
  });
}
