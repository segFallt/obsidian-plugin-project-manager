import { Notice } from "obsidian";
import type ProjectManagerPlugin from "../main";
import { EntityCreationModal } from "../ui/modals/entity-creation-modal";
import { ENTITY_TAGS } from "../constants";

/**
 * PM: Create Project
 * Prompts for a name and optional active engagement, then creates a project note
 * with an auto-generated notesDirectory.
 */
export function registerCreateProjectCommand(plugin: ProjectManagerPlugin): void {
  plugin.addCommand({
    id: "create-project",
    name: "PM: Create Project",
    callback: async () => {
      const activeEngagements = plugin.queryService.getActiveEntitiesByTag(
        ENTITY_TAGS.engagement
      );

      const modal = new EntityCreationModal(
        plugin.app,
        "New Project",
        "Project name",
        activeEngagements.length > 0 ? "Engagement (optional)" : null,
        activeEngagements
      );

      const result = await modal.prompt();
      if (!result?.name) {
        new Notice("No name provided.");
        return;
      }

      try {
        await plugin.entityService.createProject(
          result.name,
          result.parentName ?? undefined
        );
      } catch (err) {
        new Notice(`Error creating project: ${String(err)}`);
      }
    },
  });
}
