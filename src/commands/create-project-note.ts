import { Notice } from "obsidian";
import { COMMAND_IDS } from "../command-ids";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { InputModal } from "../ui/modals/input-modal";
import { MSG, COMMAND_NAMES, CMD_MODAL, LOG_CONTEXT, CMD_ERROR_LABEL } from "../constants";
import { withCommandErrorNotice } from "./command-error-notice";

/**
 * PM: Create Project Note
 * Context: the active file must be a project with a `notesDirectory` frontmatter property.
 * Prompts for a note name, then creates the note in the project's notes directory.
 */
export function registerCreateProjectNoteCommand(services: CommandServices, addCommand: AddCommandFn): void {
  addCommand({
    id: COMMAND_IDS.CREATE_PROJECT_NOTE,
    name: COMMAND_NAMES.CREATE_PROJECT_NOTE,
    callback: async () => {
      const activeFile = services.app.workspace.getActiveFile();

      if (!activeFile) {
        new Notice("No active file. Open a project note to use this command.");
        return;
      }

      const cache = services.app.metadataCache.getFileCache(activeFile);
      const notesDir = cache?.frontmatter?.notesDirectory as string | undefined;

      if (!notesDir) {
        new Notice(
          `"${activeFile.basename}" does not have a notesDirectory property. ` +
            "Open a project note to use this command."
        );
        return;
      }

      const modal = new InputModal(services.app, CMD_MODAL.CREATE_PROJECT_NOTE.title, CMD_MODAL.CREATE_PROJECT_NOTE.placeholder);
      const noteName = await modal.prompt();

      if (!noteName) {
        new Notice(MSG.NO_NAME);
        return;
      }

      services.loggerService.debug(`${LOG_CONTEXT.CREATE_PROJECT_NOTE} invoked: "${noteName}", dir: "${notesDir}"`, LOG_CONTEXT.CREATE_PROJECT_NOTE);
      await withCommandErrorNotice(
        services.loggerService,
        LOG_CONTEXT.CREATE_PROJECT_NOTE,
        (err) => `${CMD_ERROR_LABEL.CREATE_PROJECT_NOTE}: ${String(err)}`,
        () => services.entityService.createProjectNote(activeFile, noteName)
      );
    },
  });
}
