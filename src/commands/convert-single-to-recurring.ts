import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { InputModal } from "../ui/modals/input-modal";

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
    id: "convert-single-to-recurring",
    name: "PM: Convert Single Meeting to Recurring",
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
        "Recurring meeting name:",
        "Meeting name",
        activeFile.basename
      );
      const recurringName = await modal.prompt();

      if (!recurringName) {
        new Notice("No meeting name provided.");
        return;
      }

      try {
        await services.entityService.convertSingleToRecurring(activeFile, recurringName);
      } catch (err) {
        services.loggerService.error(String(err), "convert-single-to-recurring", err);
        new Notice(`Error converting meeting: ${String(err)}`);
      }
    },
  });
}
