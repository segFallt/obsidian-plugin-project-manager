import { Notice } from "obsidian";
import { COMMAND_IDS } from "../command-ids";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { ReferenceTopicCreationModal } from "../ui/modals/reference-topic-creation-modal";
import { ENTITY_TAGS, MSG, LOG_CONTEXT, COMMAND_NAMES, CMD_ERROR_LABEL } from "../constants";
import { withCommandErrorNotice } from "./command-error-notice";

/**
 * PM: Create Reference Topic
 * Prompts for a name and optional parent topic, then creates a reference topic note.
 */
export function registerCreateReferenceTopicCommand(
  services: CommandServices,
  addCommand: AddCommandFn
): void {
  addCommand({
    id: COMMAND_IDS.CREATE_REFERENCE_TOPIC,
    name: COMMAND_NAMES.CREATE_REFERENCE_TOPIC,
    callback: async () => {
      const existingTopics = services.queryService.getEntitiesByTag(ENTITY_TAGS.referenceTopic);

      const modal = new ReferenceTopicCreationModal(services.app, existingTopics);
      const result = await modal.prompt();
      if (!result?.name) {
        new Notice(MSG.NO_NAME);
        return;
      }

      services.loggerService.debug(
        `${LOG_CONTEXT.CREATE_REFERENCE_TOPIC} invoked: "${result.name}", parent: "${result.parentName ?? "none"}"`,
        LOG_CONTEXT.CREATE_REFERENCE_TOPIC
      );
      await withCommandErrorNotice(
        services.loggerService,
        LOG_CONTEXT.CREATE_REFERENCE_TOPIC,
        (err) => `${CMD_ERROR_LABEL.GENERIC}: ${String(err)}`,
        () => services.entityService.createReferenceTopic(result.name, result.parentName ?? undefined)
      );
    },
  });
}
