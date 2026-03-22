import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { InputModal } from "../ui/modals/input-modal";
import { SuggesterModal } from "../ui/modals/suggester-modal";
import type { DataviewPage } from "../types";
import { ENTITY_TAGS, MSG } from "../constants";

const NONE_SENTINEL = "(None)";
export const DONE_PREFIX = "✓ Done";

/**
 * PM: Create Reference
 * Prompts sequentially for:
 *   1. Name (InputModal)
 *   2. Topics (multi-select loop via SuggesterModal)
 *   3. Client (SuggesterModal, optional)
 *   4. Engagement (SuggesterModal, optional)
 *
 * Supports actionContext pre-fill for topic, client, or engagement fields.
 * Requires at least one topic to be selected before creating.
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

      // Pre-fill from action context
      const selectedTopics: string[] = []; // wikilink format: "[[Name]]"
      let prefilledClient: string | undefined;
      let prefilledEngagement: string | undefined;
      if (pendingCtx) {
        if (pendingCtx.field === "topic") selectedTopics.push(`[[${pendingCtx.value}]]`);
        else if (pendingCtx.field === "client") prefilledClient = pendingCtx.value;
        else if (pendingCtx.field === "engagement") prefilledEngagement = pendingCtx.value;
      }

      // Step 1: Name
      const nameModal = new InputModal(services.app, "Reference name", "e.g. Clean Architecture book");
      const name = await nameModal.prompt();
      if (!name) {
        new Notice(MSG.NO_NAME);
        return;
      }

      // Step 2: Topics (multi-select loop)
      const allTopics = services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.referenceTopic);

      let pickingTopics = true;
      while (pickingTopics) {
        const remaining = allTopics.filter(
          (t: DataviewPage) => !selectedTopics.includes(`[[${t.file.name}]]`)
        );
        const doneLabel = `${DONE_PREFIX} (${selectedTopics.length} selected)`;
        type Option = DataviewPage | typeof doneLabel;
        const options: Option[] = [doneLabel, ...remaining];
        const modal = new SuggesterModal<Option>(
          services.app,
          options,
          (item) => (item === doneLabel ? doneLabel : (item as DataviewPage).file.name),
          selectedTopics.length === 0 ? "Select topic" : "Add another topic (or Done)"
        );
        const picked = await modal.choose();
        if (picked === null || picked === doneLabel) {
          pickingTopics = false;
        } else {
          selectedTopics.push(`[[${(picked as DataviewPage).file.name}]]`);
        }
      }

      // Validate: at least one topic required
      if (selectedTopics.length === 0) {
        new Notice("At least one topic is required.");
        return;
      }

      // Step 3: Client (optional)
      const activeClients = services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.client);
      const clientOptions: Array<DataviewPage | typeof NONE_SENTINEL> = [
        NONE_SENTINEL,
        ...activeClients,
      ];
      const clientModal = new SuggesterModal<DataviewPage | typeof NONE_SENTINEL>(
        services.app,
        clientOptions,
        (item) => (item === NONE_SENTINEL ? NONE_SENTINEL : item.file.name),
        "Select client (optional)"
      );

      // If prefilled from context, skip the client modal
      let clientName: string | undefined = prefilledClient;
      if (clientName === undefined) {
        const selectedClient = await clientModal.choose();
        if (selectedClient === null) return;
        clientName =
          selectedClient === NONE_SENTINEL
            ? undefined
            : selectedClient.file.name;
      }

      // Step 4: Engagement (optional)
      const activeEngagements = services.queryService.getActiveEntitiesByTag(ENTITY_TAGS.engagement);
      const engagementOptions: Array<DataviewPage | typeof NONE_SENTINEL> = [
        NONE_SENTINEL,
        ...activeEngagements,
      ];
      const engagementModal = new SuggesterModal<DataviewPage | typeof NONE_SENTINEL>(
        services.app,
        engagementOptions,
        (item) => (item === NONE_SENTINEL ? NONE_SENTINEL : item.file.name),
        "Select engagement (optional)"
      );

      // If prefilled from context, skip the engagement modal
      let engagementName: string | undefined = prefilledEngagement;
      if (engagementName === undefined) {
        const selectedEngagement = await engagementModal.choose();
        if (selectedEngagement === null) return;
        engagementName =
          selectedEngagement === NONE_SENTINEL
            ? undefined
            : selectedEngagement.file.name;
      }

      services.loggerService.debug(
        `create-reference invoked: "${name}", topics: ${selectedTopics.join(", ")}, client: "${clientName ?? "none"}", engagement: "${engagementName ?? "none"}"`,
        "create-reference"
      );

      try {
        await services.entityService.createReference(
          name,
          selectedTopics,
          clientName,
          engagementName,
        );
      } catch (err) {
        services.loggerService.error(String(err), "create-reference", err);
        new Notice(`Error: ${String(err)}`);
      }
    },
  });
}
