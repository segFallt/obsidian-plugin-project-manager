import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { InputModal } from "../ui/modals/input-modal";
import { MSG } from "../constants";

/**
 * PM: Create Client
 * Prompts for a name and creates a new client note.
 */
export function registerCreateClientCommand(services: CommandServices, addCommand: AddCommandFn): void {
  addCommand({
    id: "create-client",
    name: "PM: Create Client",
    callback: async () => {
      const modal = new InputModal(services.app, "New client name:", "e.g. Acme Corp");
      const name = await modal.prompt();

      if (!name) {
        new Notice(MSG.NO_NAME);
        return;
      }

      services.loggerService.debug(`create-client invoked: "${name}"`, 'create-client');
      try {
        await services.entityService.createClient(name);
      } catch (err) {
        services.loggerService.error(String(err), "create-client", err);
        new Notice(`Error creating client: ${String(err)}`);
      }
    },
  });
}
