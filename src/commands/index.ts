import type ProjectManagerPlugin from "../main";
import { registerCreateClientCommand } from "./create-client";
import { registerCreateEngagementCommand } from "./create-engagement";
import { registerCreateProjectCommand } from "./create-project";
import { registerCreatePersonCommand } from "./create-person";
import { registerCreateInboxCommand } from "./create-inbox";
import { registerCreateSingleMeetingCommand } from "./create-single-meeting";
import { registerCreateRecurringMeetingCommand } from "./create-recurring-meeting";
import { registerCreateProjectNoteCommand } from "./create-project-note";
import { registerConvertInboxCommand } from "./convert-inbox-to-project";
import { registerScaffoldVaultCommand } from "./scaffold-vault";

/**
 * Registers all plugin commands with the Obsidian command palette.
 */
export function registerAllCommands(plugin: ProjectManagerPlugin): void {
  registerCreateClientCommand(plugin);
  registerCreateEngagementCommand(plugin);
  registerCreateProjectCommand(plugin);
  registerCreatePersonCommand(plugin);
  registerCreateInboxCommand(plugin);
  registerCreateSingleMeetingCommand(plugin);
  registerCreateRecurringMeetingCommand(plugin);
  registerCreateProjectNoteCommand(plugin);
  registerConvertInboxCommand(plugin);
  registerScaffoldVaultCommand(plugin);
}
