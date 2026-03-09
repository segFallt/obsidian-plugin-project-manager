import { Notice } from "obsidian";
import type { PluginServices, AddCommandFn } from "../plugin-context";
import { EntityCreationModal } from "../ui/modals/entity-creation-modal";
import { ENTITY_TAGS } from "../constants";

/**
 * PM: Create Project
 * Prompts for a name and optional active engagement, then creates a project note
 * with an auto-generated notesDirectory.
 */
export function registerCreateProjectCommand(services: PluginServices, addCommand: AddCommandFn): void {
  addCommand({
    id: "create-project",
    name: "PM: Create Project",
    callback: async () => {
      const pendingCtx = services.pendingActionContext;
      services.pendingActionContext = null;

      const activeEngagements = services.queryService.getActiveEntitiesByTag(
        ENTITY_TAGS.engagement
      );
      const preselected = pendingCtx?.field === "engagement" ? pendingCtx.value : undefined;

      const modal = new EntityCreationModal(
        services.app,
        "New Project",
        "Project name",
        activeEngagements.length > 0 ? "Engagement (optional)" : null,
        activeEngagements,
        preselected
      );

      const result = await modal.prompt();
      if (!result?.name) {
        new Notice("No name provided.");
        return;
      }

      try {
        await services.entityService.createProject(
          result.name,
          result.parentName ?? undefined
        );
      } catch (err) {
        services.loggerService.error(String(err), "create-project", err);
        new Notice(`Error creating project: ${String(err)}`);
      }
    },
  });
}
