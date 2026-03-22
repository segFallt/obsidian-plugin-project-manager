import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { EntityCreationModal } from "../ui/modals/entity-creation-modal";
import { ENTITY_TAGS, MSG } from "../constants";

/**
 * PM: Create Person
 * Prompts for a name and optional active client, then creates a person note.
 */
export function registerCreatePersonCommand(services: CommandServices, addCommand: AddCommandFn): void {
  addCommand({
    id: "create-person",
    name: "PM: Create Person",
    callback: async () => {
      const pendingCtx = services.actionContext.consume();

      const activeClients = services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.client);
      const preselected = pendingCtx?.field === "client" ? pendingCtx.value : undefined;

      const modal = new EntityCreationModal(
        services.app,
        "New Person",
        "Person name",
        activeClients.length > 0 ? "Client (optional)" : null,
        activeClients,
        preselected
      );

      const result = await modal.prompt();
      if (!result?.name) {
        new Notice(MSG.NO_NAME);
        return;
      }

      services.loggerService.debug(`create-person invoked: "${result.name}", client: "${result.parentName ?? 'none'}"`, 'create-person');
      try {
        await services.entityService.createPerson(result.name, result.parentName ?? undefined);
      } catch (err) {
        services.loggerService.error(String(err), "create-person", err);
        new Notice(`Error creating person: ${String(err)}`);
      }
    },
  });
}
