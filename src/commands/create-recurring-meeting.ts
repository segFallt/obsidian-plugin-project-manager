import type { CommandServices, AddCommandFn } from "../plugin-context";
import { registerEntityCreateCommand } from "./register-entity-create-command";
import { CREATE_RECURRING_MEETING_DESCRIPTOR } from "./entity-command-descriptors";

/**
 * PM: Create Recurring Meeting
 * Prompts for a name and optional engagement, then creates a recurring meeting note.
 */
export function registerCreateRecurringMeetingCommand(services: CommandServices, addCommand: AddCommandFn): void {
  registerEntityCreateCommand(services, addCommand, CREATE_RECURRING_MEETING_DESCRIPTOR);
}
