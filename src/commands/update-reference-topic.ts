import { Notice } from "obsidian";
import { COMMAND_IDS } from "../command-ids";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { ReferenceTopicUpdateModal } from "../ui/modals/reference-topic-update-modal";
import { ENTITY_TAGS, LOG_CONTEXT, COMMAND_NAMES, CMD_ERROR_LABEL } from "../constants";
import { withCommandErrorNotice } from "./command-error-notice";

/**
 * PM: Update Reference Topic
 * Selects an existing reference topic and assigns or clears its parent.
 */
export function registerUpdateReferenceTopicCommand(
  services: CommandServices,
  addCommand: AddCommandFn
): void {
  addCommand({
    id: COMMAND_IDS.UPDATE_REFERENCE_TOPIC,
    name: COMMAND_NAMES.UPDATE_REFERENCE_TOPIC,
    callback: async () => {
      const topics = services.queryService.getEntitiesByTag(ENTITY_TAGS.referenceTopic);
      if (topics.length === 0) {
        new Notice("No reference topics found. Create one first.");
        return;
      }

      const modal = new ReferenceTopicUpdateModal(services.app, topics);
      const result = await modal.prompt();
      if (!result) return;

      services.loggerService.debug(
        `${LOG_CONTEXT.UPDATE_REFERENCE_TOPIC}: "${result.topicName}", parent: "${result.parentName ?? "none"}"`,
        LOG_CONTEXT.UPDATE_REFERENCE_TOPIC
      );

      await withCommandErrorNotice(
        services.loggerService,
        LOG_CONTEXT.UPDATE_REFERENCE_TOPIC,
        (err) => `${CMD_ERROR_LABEL.GENERIC}: ${String(err)}`,
        async () => {
          await services.entityService.setReferenceTopicParent(
            result.topicName,
            result.parentName ?? undefined
          );
          new Notice(`Updated "${result.topicName}".`);
        }
      );
    },
  });
}
