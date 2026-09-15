import { Notice } from "obsidian";
import type { INotificationService } from "./interfaces";

/**
 * Thin wrapper over Obsidian's Notice so the services layer can signal
 * user-facing messages without constructing UI directly.
 */
export class NotificationService implements INotificationService {
  notify(message: string): void {
    new Notice(message);
  }
}
