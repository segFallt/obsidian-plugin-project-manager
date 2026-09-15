import type { CommandServices, AddCommandFn } from "../plugin-context";
import { registerEntityCreateCommand } from "./register-entity-create-command";
import { CREATE_INBOX_DESCRIPTOR } from "./entity-command-descriptors";

/**
 * PM: Create Inbox Note
 * Prompts for a name and optional engagement, then creates an inbox note.
 */
export function registerCreateInboxCommand(services: CommandServices, addCommand: AddCommandFn): void {
  registerEntityCreateCommand(services, addCommand, CREATE_INBOX_DESCRIPTOR);
}
