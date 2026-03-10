import type { App, TFile } from "obsidian";
import type { INavigationService } from "./interfaces";

/**
 * Encapsulates file navigation (opening files in a new tab).
 * Extracted from EntityService to satisfy SRP.
 */
export class NavigationService implements INavigationService {
  constructor(private readonly app: App) {}

  async openFile(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file);
  }
}
