import type ProjectManagerPlugin from "../main";
import { registerPmTableProcessor } from "./pm-table-processor";
import { registerPmPropertiesProcessor } from "./pm-properties-processor";
import { registerPmActionsProcessor } from "./pm-actions-processor";
import { registerPmTasksProcessor } from "./pm-tasks-processor";
import { registerPmEntityViewProcessor } from "./pm-entity-view-processor";
import { registerPmRecurringEventsProcessor } from "./pm-recurring-events-processor";

/**
 * Registers all markdown code block processors.
 * Each `pm-*` code block becomes a rich interactive component.
 *
 * This is the only processor-layer file that depends on the concrete
 * ProjectManagerPlugin class. All individual processor files depend only
 * on the narrow PluginServices interface.
 */
export function registerAllProcessors(plugin: ProjectManagerPlugin): void {
  const registerProcessor = plugin.registerMarkdownCodeBlockProcessor.bind(plugin);
  registerPmTableProcessor(plugin, registerProcessor);
  registerPmPropertiesProcessor(plugin, registerProcessor);
  registerPmActionsProcessor(plugin, registerProcessor);
  registerPmTasksProcessor(plugin, registerProcessor);
  registerPmEntityViewProcessor(plugin, registerProcessor);
  registerPmRecurringEventsProcessor(plugin, registerProcessor);
}
