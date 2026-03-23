import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { InputModal } from "../ui/modals/input-modal";
import { MSG, LOG_CONTEXT } from "../constants";

/**
 * PM: Create Reference Topic
 * Prompts for a name and creates a reference topic note.
 */
export function registerCreateReferenceTopicCommand(
  services: CommandServices,
  addCommand: AddCommandFn
): void {
  addCommand({
    id: "create-reference-topic",
    name: "PM: Create Reference Topic",
    callback: async () => {
      const modal = new InputModal(services.app, "Reference topic name", "e.g. Architecture");
      const name = await modal.prompt();
      if (!name) {
        new Notice(MSG.NO_NAME);
        return;
      }
      services.loggerService.debug(`create-reference-topic invoked: "${name}"`, LOG_CONTEXT.CREATE_REFERENCE_TOPIC);
      try {
        await services.entityService.createReferenceTopic(name);
      } catch (err) {
        services.loggerService.error(String(err), LOG_CONTEXT.CREATE_REFERENCE_TOPIC, err);
        new Notice(`Error: ${String(err)}`);
      }
    },
  });
}
