import type { CommandServices, AddCommandFn } from "../plugin-context";
import { registerEntityCreateCommand } from "./register-entity-create-command";
import { CREATE_ENGAGEMENT_DESCRIPTOR } from "./entity-command-descriptors";

/**
 * PM: Create Engagement
 * Prompts for a name and optional active client, then creates an engagement note.
 */
export function registerCreateEngagementCommand(services: CommandServices, addCommand: AddCommandFn): void {
  registerEntityCreateCommand(services, addCommand, CREATE_ENGAGEMENT_DESCRIPTOR);
}
