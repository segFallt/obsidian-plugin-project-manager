import type ProjectManagerPlugin from "../main";
import { registerCreateClientCommand } from "./create-client";
import { registerCreateEngagementCommand } from "./create-engagement";
import { registerCreateProjectCommand } from "./create-project";
import { registerCreatePersonCommand } from "./create-person";
import { registerCreateInboxCommand } from "./create-inbox";
import { registerCreateSingleMeetingCommand } from "./create-single-meeting";
import { registerCreateRecurringMeetingCommand } from "./create-recurring-meeting";
import { registerCreateRecurringMeetingEventCommand } from "./create-recurring-meeting-event";
import { registerCreateProjectNoteCommand } from "./create-project-note";
import { registerConvertInboxCommand } from "./convert-inbox-to-project";
import { registerConvertSingleToRecurringCommand } from "./convert-single-to-recurring";
import { registerScaffoldVaultCommand } from "./scaffold-vault";

/**
 * Registers all plugin commands with the Obsidian command palette.
 *
 * This is the only command-layer file that depends on the concrete
 * ProjectManagerPlugin class. All individual command files depend only
 * on the narrow PluginServices interface.
 */
export function registerAllCommands(plugin: ProjectManagerPlugin): void {
  const addCommand = plugin.addCommand.bind(plugin);
  registerCreateClientCommand(plugin, addCommand);
  registerCreateEngagementCommand(plugin, addCommand);
  registerCreateProjectCommand(plugin, addCommand);
  registerCreatePersonCommand(plugin, addCommand);
  registerCreateInboxCommand(plugin, addCommand);
  registerCreateSingleMeetingCommand(plugin, addCommand);
  registerCreateRecurringMeetingCommand(plugin, addCommand);
  registerCreateRecurringMeetingEventCommand(plugin, addCommand);
  registerCreateProjectNoteCommand(plugin, addCommand);
  registerConvertInboxCommand(plugin, addCommand);
  registerConvertSingleToRecurringCommand(plugin, addCommand);
  registerScaffoldVaultCommand(plugin, addCommand);
}
