import { Notice } from "obsidian";
import type { PluginServices, AddCommandFn } from "../plugin-context";
import { InputModal } from "../ui/modals/input-modal";

/**
 * PM: Create Client
 * Prompts for a name and creates a new client note.
 */
export function registerCreateClientCommand(services: PluginServices, addCommand: AddCommandFn): void {
  addCommand({
    id: "create-client",
    name: "PM: Create Client",
    callback: async () => {
      const modal = new InputModal(services.app, "New client name:", "e.g. Acme Corp");
      const name = await modal.prompt();

      if (!name) {
        new Notice("No name provided.");
        return;
      }

      try {
        await services.entityService.createClient(name);
      } catch (err) {
        new Notice(`Error creating client: ${String(err)}`);
      }
    },
  });
}
