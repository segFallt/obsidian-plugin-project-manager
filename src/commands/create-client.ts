import type { CommandServices, AddCommandFn } from "../plugin-context";
import { registerEntityCreateCommand } from "./register-entity-create-command";
import { CREATE_CLIENT_DESCRIPTOR } from "./entity-command-descriptors";

/**
 * PM: Create Client
 * Prompts for a name and creates a new client note.
 */
export function registerCreateClientCommand(services: CommandServices, addCommand: AddCommandFn): void {
  registerEntityCreateCommand(services, addCommand, CREATE_CLIENT_DESCRIPTOR);
}
