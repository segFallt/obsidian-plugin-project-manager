import type ProjectManagerPlugin from "../main";
import { registerEntityCreateCommand } from "./register-entity-create-command";
import { ENTITY_CREATE_DESCRIPTORS } from "./entity-command-descriptors";
import { registerCreateRecurringMeetingEventCommand } from "./create-recurring-meeting-event";
import { registerCreateProjectNoteCommand } from "./create-project-note";
import { registerConvertInboxCommand } from "./convert-inbox-to-project";
import { registerConvertSingleToRecurringCommand } from "./convert-single-to-recurring";
import { registerScaffoldVaultCommand } from "./scaffold-vault";
import { registerCreateRaidItemCommand } from "./create-raid-item";
import { registerTagRaidReferenceCommand } from "./tag-raid-reference";
import { registerCreateReferenceTopicCommand } from "./create-reference-topic";
import { registerCreateReferenceCommand } from "./create-reference";
import { registerUpdateReferenceTopicCommand } from "./update-reference-topic";

/**
 * Registers all plugin commands with the Obsidian command palette.
 *
 * This is the only command-layer file that depends on the concrete
 * ProjectManagerPlugin class. All individual command files depend only
 * on the narrow PluginServices interface.
 *
 * Table-driven entity-creation commands are registered by iterating
 * ENTITY_CREATE_DESCRIPTORS; commands with bespoke modal flows are wired
 * individually below.
 */
export function registerAllCommands(plugin: ProjectManagerPlugin): void {
  const addCommand = plugin.addCommand.bind(plugin);

  for (const descriptor of ENTITY_CREATE_DESCRIPTORS) {
    registerEntityCreateCommand(plugin, addCommand, descriptor);
  }

  registerCreateRecurringMeetingEventCommand(plugin, addCommand);
  registerCreateProjectNoteCommand(plugin, addCommand);
  registerConvertInboxCommand(plugin, addCommand);
  registerConvertSingleToRecurringCommand(plugin, addCommand);
  registerScaffoldVaultCommand(plugin, addCommand);
  registerCreateRaidItemCommand(plugin, addCommand);
  registerTagRaidReferenceCommand(plugin, addCommand);
  registerCreateReferenceTopicCommand(plugin, addCommand);
  registerUpdateReferenceTopicCommand(plugin, addCommand);
  registerCreateReferenceCommand(plugin, addCommand);
}
