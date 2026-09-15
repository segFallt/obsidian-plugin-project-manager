import type { CommandServices, AddCommandFn } from "../plugin-context";
import { registerEntityCreateCommand } from "./register-entity-create-command";
import { CREATE_PROJECT_DESCRIPTOR } from "./entity-command-descriptors";

/**
 * PM: Create Project
 * Prompts for a name and optional active engagement, then creates a project note
 * with an auto-generated notesDirectory.
 */
export function registerCreateProjectCommand(services: CommandServices, addCommand: AddCommandFn): void {
  registerEntityCreateCommand(services, addCommand, CREATE_PROJECT_DESCRIPTOR);
}
