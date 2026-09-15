import { Notice } from "obsidian";
import { COMMAND_IDS } from "../command-ids";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { InputModal } from "../ui/modals/input-modal";
import { COMMAND_NAMES, CMD_MODAL, LOG_CONTEXT, CMD_ERROR_LABEL } from "../constants";
import { withCommandErrorNotice } from "./command-error-notice";

/**
 * PM: Convert Inbox to Project
 * Context: the active file must be in the inbox folder.
 * Prompts for a project name (defaults to the inbox note name), then:
 * - Creates a project with notesDirectory and inherited engagement
 * - Links the inbox note back to the project (bidirectional)
 * - Sets inbox status to Complete
 */
export function registerConvertInboxCommand(services: CommandServices, addCommand: AddCommandFn): void {
  addCommand({
    id: COMMAND_IDS.CONVERT_INBOX,
    name: COMMAND_NAMES.CONVERT_INBOX,
    callback: async () => {
      const activeFile = services.app.workspace.getActiveFile();

      if (!activeFile) {
        new Notice("No active file. Open an inbox item to convert it.");
        return;
      }

      if (!activeFile.path.startsWith(services.settings.folders.inbox + "/")) {
        new Notice(
          "The active file is not in the inbox folder. " +
            "Open an inbox item to use this command."
        );
        return;
      }

      const modal = new InputModal(
        services.app,
        CMD_MODAL.CONVERT_INBOX.title,
        CMD_MODAL.CONVERT_INBOX.placeholder,
        activeFile.basename
      );
      const projectName = await modal.prompt();

      if (!projectName) {
        new Notice("No project name provided.");
        return;
      }

      services.loggerService.debug(`${LOG_CONTEXT.CONVERT_INBOX_TO_PROJECT} invoked: "${activeFile.basename}" -> "${projectName}"`, LOG_CONTEXT.CONVERT_INBOX_TO_PROJECT);
      await withCommandErrorNotice(
        services.loggerService,
        LOG_CONTEXT.CONVERT_INBOX_TO_PROJECT,
        (err) => `${CMD_ERROR_LABEL.CONVERT_INBOX_TO_PROJECT}: ${String(err)}`,
        () => services.entityService.convertInboxToProject(activeFile, projectName)
      );
    },
  });
}
