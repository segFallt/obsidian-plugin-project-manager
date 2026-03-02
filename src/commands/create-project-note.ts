import { Notice } from "obsidian";
import type ProjectManagerPlugin from "../main";
import { InputModal } from "../ui/modals/input-modal";

/**
 * PM: Create Project Note
 * Context: the active file must be a project with a `notesDirectory` frontmatter property.
 * Prompts for a note name, then creates the note in the project's notes directory.
 */
export function registerCreateProjectNoteCommand(plugin: ProjectManagerPlugin): void {
  plugin.addCommand({
    id: "create-project-note",
    name: "PM: Create Project Note",
    callback: async () => {
      const activeFile = plugin.app.workspace.getActiveFile();

      if (!activeFile) {
        new Notice("No active file. Open a project note to use this command.");
        return;
      }

      const cache = plugin.app.metadataCache.getFileCache(activeFile);
      const notesDir = cache?.frontmatter?.notesDirectory as string | undefined;

      if (!notesDir) {
        new Notice(
          `"${activeFile.basename}" does not have a notesDirectory property. ` +
            "Open a project note to use this command."
        );
        return;
      }

      const modal = new InputModal(plugin.app, "New project note name:", "Note name");
      const noteName = await modal.prompt();

      if (!noteName) {
        new Notice("No name provided.");
        return;
      }

      try {
        await plugin.entityService.createProjectNote(activeFile, noteName);
      } catch (err) {
        new Notice(`Error creating project note: ${String(err)}`);
      }
    },
  });
}
