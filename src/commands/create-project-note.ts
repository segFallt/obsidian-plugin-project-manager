import { Notice } from "obsidian";
import type { CommandServices, AddCommandFn } from "../plugin-context";
import { InputModal } from "../ui/modals/input-modal";
import { MSG } from "../constants";

/**
 * PM: Create Project Note
 * Context: the active file must be a project with a `notesDirectory` frontmatter property.
 * Prompts for a note name, then creates the note in the project's notes directory.
 */
export function registerCreateProjectNoteCommand(services: CommandServices, addCommand: AddCommandFn): void {
  addCommand({
    id: "create-project-note",
    name: "PM: Create Project Note",
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

      const modal = new InputModal(services.app, "New project note name:", "Note name");
      const noteName = await modal.prompt();

      if (!noteName) {
        new Notice(MSG.NO_NAME);
        return;
      }

      try {
        await services.entityService.createProjectNote(activeFile, noteName);
      } catch (err) {
        services.loggerService.error(String(err), "create-project-note", err);
        new Notice(`Error creating project note: ${String(err)}`);
      }
    },
  });
}
