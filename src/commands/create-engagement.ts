import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { EntityCreationModal } from "../ui/modals/entity-creation-modal";
import { ENTITY_TAGS, MSG } from "../constants";

/**
 * PM: Create Engagement
 * Prompts for a name and optional active client, then creates an engagement note.
 */
export function registerCreateEngagementCommand(services: CommandServices, addCommand: AddCommandFn): void {
  addCommand({
    id: "create-engagement",
    name: "PM: Create Engagement",
    callback: async () => {
      const pendingCtx = services.actionContext.consume();

      const activeClients = services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.client);
      const preselected = pendingCtx?.field === "client" ? pendingCtx.value : undefined;

      const modal = new EntityCreationModal(
        services.app,
        "New Engagement",
        "Engagement name",
        activeClients.length > 0 ? "Client (optional)" : null,
        activeClients,
        preselected
      );

      const result = await modal.prompt();
      if (!result?.name) {
        new Notice(MSG.NO_NAME);
        return;
      }

      try {
        await services.entityService.createEngagement(result.name, result.parentName ?? undefined);
      } catch (err) {
        services.loggerService.error(String(err), "create-engagement", err);
        new Notice(`Error creating engagement: ${String(err)}`);
      }
    },
  });
}
