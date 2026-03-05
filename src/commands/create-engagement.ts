import { Notice } from "obsidian";
import type { PluginServices, AddCommandFn } from "../plugin-context";
import { EntityCreationModal } from "../ui/modals/entity-creation-modal";
import { ENTITY_TAGS } from "../constants";

/**
 * PM: Create Engagement
 * Prompts for a name and optional active client, then creates an engagement note.
 */
export function registerCreateEngagementCommand(services: PluginServices, addCommand: AddCommandFn): void {
  addCommand({
    id: "create-engagement",
    name: "PM: Create Engagement",
    callback: async () => {
      const pendingCtx = services.pendingActionContext;
      services.pendingActionContext = null;

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
        new Notice("No name provided.");
        return;
      }

      try {
        await services.entityService.createEngagement(result.name, result.parentName ?? undefined);
      } catch (err) {
        new Notice(`Error creating engagement: ${String(err)}`);
      }
    },
  });
}
