import type { App } from "obsidian";
import type { ICommandExecutor } from "./interfaces";

/**
 * Encapsulates the unsafe `app.commands.executeCommandById` type cast.
 * Centralises the single type-unsafe operation in one place.
 */
export class CommandExecutor implements ICommandExecutor {
  constructor(private readonly app: App) {}

  executeCommandById(commandId: string): void {
    (this.app as unknown as { commands: { executeCommandById: (id: string) => void } })
      .commands.executeCommandById(commandId);
  }
}
