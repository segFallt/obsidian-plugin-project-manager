import { Notice } from "obsidian";
import type ProjectManagerPlugin from "../main";
import { InputModal } from "../ui/modals/input-modal";

/**
 * PM: Create Client
 * Prompts for a name and creates a new client note.
 */
export function registerCreateClientCommand(plugin: ProjectManagerPlugin): void {
  plugin.addCommand({
    id: "create-client",
    name: "PM: Create Client",
    callback: async () => {
      const modal = new InputModal(plugin.app, "New client name:", "e.g. Acme Corp");
      const name = await modal.prompt();

      if (!name) {
        new Notice("No name provided.");
        return;
      }

      try {
        await plugin.entityService.createClient(name);
      } catch (err) {
        new Notice(`Error creating client: ${String(err)}`);
      }
    },
  });
}
