import type { App } from "obsidian";
import type { ICommandExecutor } from "./interfaces";

/**
 * Encapsulates the unsafe `app.commands.executeCommandById` type cast.
 * Centralises the single type-unsafe operation in one place.
 *
 * Also owns the plugin's command-ID prefix (the manifest `id`), so a rename
 * of the plugin can never desync the button → command wiring again. Callers
 * pass **bare** command IDs (e.g. `"create-client"`) for this plugin's own
 * commands; these are prefixed with the injected manifest id. Fully-qualified
 * IDs (containing `":"`, e.g. a user-supplied `"workspace:split-vertical"`)
 * are treated as foreign and passed through unchanged.
 */
export class CommandExecutor implements ICommandExecutor {
  constructor(
    private readonly app: App,
    private readonly pluginId: string
  ) {}

  executeCommandById(commandId: string): void {
    // Bare ids (no ":") are this plugin's own commands → prefix with the manifest id.
    // Fully-qualified ids (contain ":") are foreign/explicit → pass through unchanged.
    const fullId = commandId.includes(":") ? commandId : `${this.pluginId}:${commandId}`;
    (this.app as unknown as { commands: { executeCommandById: (id: string) => void } })
      .commands.executeCommandById(fullId);
  }
}
