import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { ReferenceTopicCreationModal } from "../ui/modals/reference-topic-creation-modal";
import { ENTITY_TAGS, MSG, LOG_CONTEXT } from "../constants";

/**
 * PM: Create Reference Topic
 * Prompts for a name and optional parent topic, then creates a reference topic note.
 */
export function registerCreateReferenceTopicCommand(
  services: CommandServices,
  addCommand: AddCommandFn
): void {
  addCommand({
    id: "create-reference-topic",
    name: "PM: Create Reference Topic",
    callback: async () => {
      const existingTopics = services.queryService.getEntitiesByTag(ENTITY_TAGS.referenceTopic);

      const modal = new ReferenceTopicCreationModal(services.app, existingTopics);
      const result = await modal.prompt();
      if (!result?.name) {
        new Notice(MSG.NO_NAME);
        return;
      }

      services.loggerService.debug(
        `create-reference-topic invoked: "${result.name}", parent: "${result.parentName ?? "none"}"`,
        LOG_CONTEXT.CREATE_REFERENCE_TOPIC
      );
      try {
        await services.entityService.createReferenceTopic(result.name, result.parentName ?? undefined);
      } catch (err) {
        services.loggerService.error(String(err), LOG_CONTEXT.CREATE_REFERENCE_TOPIC, err);
        new Notice(`Error: ${String(err)}`);
      }
    },
  });
}
