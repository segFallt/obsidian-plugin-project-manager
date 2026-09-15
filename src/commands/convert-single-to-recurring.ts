import { Notice } from "obsidian";
import { COMMAND_IDS } from "../command-ids";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { InputModal } from "../ui/modals/input-modal";
import { COMMAND_NAMES, CMD_MODAL, LOG_CONTEXT, CMD_ERROR_LABEL } from "../constants";
import { withCommandErrorNotice } from "./command-error-notice";

/**
 * PM: Convert Single Meeting to Recurring
 * Context: the active file must be in the single meetings folder.
 * Prompts for a recurring meeting name (defaults to the single meeting note name), then:
 * - Creates a recurring meeting with the name
 * - Creates a first event copying date, attendees, and notes from the single meeting
 * - Deletes the original single meeting note
 */
export function registerConvertSingleToRecurringCommand(
  services: CommandServices,
  addCommand: AddCommandFn
): void {
  addCommand({
    id: COMMAND_IDS.CONVERT_SINGLE_TO_RECURRING,
    name: COMMAND_NAMES.CONVERT_SINGLE_TO_RECURRING,
    callback: async () => {
      const activeFile = services.app.workspace.getActiveFile();

      if (!activeFile) {
        new Notice("No active file. Open a single meeting to convert it.");
        return;
      }

      if (!activeFile.path.startsWith(services.settings.folders.meetingsSingle + "/")) {
        new Notice(
          "The active file is not in the single meetings folder. " +
            "Open a single meeting note to use this command."
        );
        return;
      }

      const modal = new InputModal(
        services.app,
        CMD_MODAL.CONVERT_SINGLE_TO_RECURRING.title,
        CMD_MODAL.CONVERT_SINGLE_TO_RECURRING.placeholder,
        activeFile.basename
      );
      const recurringName = await modal.prompt();

      if (!recurringName) {
        new Notice("No meeting name provided.");
        return;
      }

      services.loggerService.debug(`${LOG_CONTEXT.CONVERT_SINGLE_TO_RECURRING} invoked: "${activeFile.basename}" -> "${recurringName}"`, LOG_CONTEXT.CONVERT_SINGLE_TO_RECURRING);
      await withCommandErrorNotice(
        services.loggerService,
        LOG_CONTEXT.CONVERT_SINGLE_TO_RECURRING,
        (err) => `${CMD_ERROR_LABEL.CONVERT_SINGLE_TO_RECURRING}: ${String(err)}`,
        () => services.entityService.convertSingleToRecurring(activeFile, recurringName)
      );
    },
  });
}
