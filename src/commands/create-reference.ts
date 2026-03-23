import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { ReferenceCreationModal } from "../ui/modals/reference-creation-modal";
import { ENTITY_TAGS, MSG, LOG_CONTEXT } from "../constants";

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
    id: "create-reference",
    name: "PM: Create Reference",
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
        `create-reference: name: "${result.name}", topics: ${result.topics.join(", ")}, client: "${result.clientName ?? "none"}", engagement: "${result.engagementName ?? "none"}"`,
        LOG_CONTEXT.CREATE_REFERENCE
      );

      try {
        await services.entityService.createReference(
          result.name,
          result.topics,
          result.clientName,
          result.engagementName
        );
      } catch (err) {
        services.loggerService.error(String(err), LOG_CONTEXT.CREATE_REFERENCE, err);
        new Notice(`Error creating reference: ${String(err)}`);
      }
    },
  });
}
