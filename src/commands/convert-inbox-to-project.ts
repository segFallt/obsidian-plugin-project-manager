import { Notice } from "obsidian";
import type { PluginServices, AddCommandFn } from "../plugin-context";
import { InputModal } from "../ui/modals/input-modal";

/**
 * PM: Convert Inbox to Project
 * Context: the active file must be in the inbox folder.
 * Prompts for a project name (defaults to the inbox note name), then:
 * - Creates a project with notesDirectory and inherited engagement
 * - Links the inbox note back to the project (bidirectional)
 * - Sets inbox status to Inactive
 */
export function registerConvertInboxCommand(services: PluginServices, addCommand: AddCommandFn): void {
  addCommand({
    id: "convert-inbox",
    name: "PM: Convert Inbox to Project",
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
        "Project name:",
        "Project name",
        activeFile.basename
      );
      const projectName = await modal.prompt();

      if (!projectName) {
        new Notice("No project name provided.");
        return;
      }

      try {
        await services.entityService.convertInboxToProject(activeFile, projectName);
      } catch (err) {
        services.loggerService.error(String(err), "convert-inbox-to-project", err);
        new Notice(`Error converting inbox to project: ${String(err)}`);
      }
    },
  });
}
