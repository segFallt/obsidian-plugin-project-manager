import { Notice } from "obsidian";
import { COMMAND_IDS } from "../command-ids";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { ReferenceCreationModal } from "../ui/modals/reference-creation-modal";
import { ENTITY_TAGS, MSG, LOG_CONTEXT, COMMAND_NAMES, CMD_ERROR_LABEL } from "../constants";
import { withCommandErrorNotice } from "./command-error-notice";

/**
 * PM: Create Reference
 * Opens a compound modal collecting name, one or more topics, optional client, and optional engagement,
 * then creates a Reference note via entityService.createReference().
 *
 * Supports actionContext pre-fill for topic, client, or engagement fields.
 */
export function registerCreateReferenceCommand(
  services: CommandServices,
  addCommand: AddCommandFn
): void {
  addCommand({
    id: COMMAND_IDS.CREATE_REFERENCE,
    name: COMMAND_NAMES.CREATE_REFERENCE,
    callback: async () => {
      const pendingCtx = services.actionContext.consume();

      // Resolve pre-fills from action context
      const preselectedTopics: string[] = [];
      let preselectedClient: string | undefined;
      let preselectedEngagement: string | undefined;
      if (pendingCtx) {
        if (pendingCtx.field === "topic") preselectedTopics.push(`[[${pendingCtx.value}]]`);
        else if (pendingCtx.field === "client") preselectedClient = pendingCtx.value;
        else if (pendingCtx.field === "engagement") preselectedEngagement = pendingCtx.value;
      }

      const topics = services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.referenceTopic);
      const clients = services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.client);
      const engagements = services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.engagement);

      const modal = new ReferenceCreationModal(
        services.app,
        topics,
        clients,
        engagements,
        preselectedTopics,
        preselectedClient,
        preselectedEngagement
      );
      const result = await modal.prompt();

      if (!result) {
        new Notice(MSG.CANCELLED);
        return;
      }

      services.loggerService.debug(
        `${LOG_CONTEXT.CREATE_REFERENCE}: name: "${result.name}", topics: ${result.topics.join(", ")}, client: "${result.clientName ?? "none"}", engagement: "${result.engagementName ?? "none"}"`,
        LOG_CONTEXT.CREATE_REFERENCE
      );

      await withCommandErrorNotice(
        services.loggerService,
        LOG_CONTEXT.CREATE_REFERENCE,
        (err) => `${CMD_ERROR_LABEL.CREATE_REFERENCE}: ${String(err)}`,
        () =>
          services.entityService.createReference(
            result.name,
            result.topics,
            result.clientName,
            result.engagementName
          )
      );
    },
  });
}
