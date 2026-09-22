import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { MSG } from "../constants";
import { withCommandErrorNotice } from "./command-error-notice";
import type { EntityCreateDescriptor } from "./entity-command-descriptors";

/**
 * Registers a single table-driven entity-creation command from its descriptor.
 *
 * The flow is identical for every descriptor: open the modal, guard the name,
 * log a debug line, then run the creation call inside the shared error-notice
 * wrapper. Per-command wording (id, name, modal, debug/error strings, service
 * method) comes entirely from the descriptor.
 */
export function registerEntityCreateCommand(
  services: CommandServices,
  addCommand: AddCommandFn,
  descriptor: EntityCreateDescriptor
): void {
  addCommand({
    id: descriptor.id,
    name: descriptor.name,
    callback: async () => {
      const result = await descriptor.prompt(services);
      if (!result?.name) {
        new Notice(MSG.NO_NAME);
        return;
      }

      services.loggerService.debug(descriptor.debugMessage(result), descriptor.context);
      await withCommandErrorNotice(
        services.loggerService,
        descriptor.context,
        descriptor.errorMessage,
        () => descriptor.create(services, result)
      );
    },
  });
}
