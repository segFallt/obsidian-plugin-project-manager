import { Notice } from "obsidian";
import type { ILoggerService } from "../services/interfaces";

/**
 * Runs a command action, logging and surfacing any thrown error through a
 * single shared handler instead of an inline `try/catch → logger.error →
 * new Notice(...)` block repeated across every command.
 *
 * The user-facing message is supplied by the caller (`buildMessage`) so each
 * command keeps its own Notice wording — some commands report a generic
 * `Error: <err>` while others report `Error creating <entity>: <err>`.
 */
export async function withCommandErrorNotice(
  logger: ILoggerService,
  context: string,
  buildMessage: (err: unknown) => string,
  action: () => unknown
): Promise<void> {
  try {
    await action();
  } catch (err) {
    logger.error(String(err), context, err);
    new Notice(buildMessage(err));
  }
}
