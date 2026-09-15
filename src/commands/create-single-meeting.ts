import type { CommandServices, AddCommandFn } from "../plugin-context";
import { registerEntityCreateCommand } from "./register-entity-create-command";
import { CREATE_SINGLE_MEETING_DESCRIPTOR } from "./entity-command-descriptors";

/**
 * PM: Create Single Meeting
 * Prompts for a name and optional engagement, then creates a single meeting note.
 */
export function registerCreateSingleMeetingCommand(services: CommandServices, addCommand: AddCommandFn): void {
  registerEntityCreateCommand(services, addCommand, CREATE_SINGLE_MEETING_DESCRIPTOR);
}
