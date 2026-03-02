import type ProjectManagerPlugin from "../main";
import { registerPmTableProcessor } from "./pm-table-processor";
import { registerPmPropertiesProcessor } from "./pm-properties-processor";
import { registerPmActionsProcessor } from "./pm-actions-processor";
import { registerPmTasksProcessor } from "./pm-tasks-processor";

/**
 * Registers all markdown code block processors.
 * Each `pm-*` code block becomes a rich interactive component.
 */
export function registerAllProcessors(plugin: ProjectManagerPlugin): void {
  registerPmTableProcessor(plugin);
  registerPmPropertiesProcessor(plugin);
  registerPmActionsProcessor(plugin);
  registerPmTasksProcessor(plugin);
}
