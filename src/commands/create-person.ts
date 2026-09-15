import type { CommandServices, AddCommandFn } from "../plugin-context";
import { registerEntityCreateCommand } from "./register-entity-create-command";
import { CREATE_PERSON_DESCRIPTOR } from "./entity-command-descriptors";

/**
 * PM: Create Person
 * Prompts for a name and optional active client, then creates a person note.
 */
export function registerCreatePersonCommand(services: CommandServices, addCommand: AddCommandFn): void {
  registerEntityCreateCommand(services, addCommand, CREATE_PERSON_DESCRIPTOR);
}
