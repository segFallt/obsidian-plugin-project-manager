import { App, Notice } from "obsidian";
import type { ProjectManagerSettings } from "../settings";
import { ensureFolderExists } from "../utils/path-utils";

/**
 * Creates the full vault folder structure and default view files.
 *
 * Safe to run on an existing vault — existing files are not overwritten.
 */
export class VaultScaffoldService {
  constructor(
    private readonly app: App,
    private readonly settings: ProjectManagerSettings
  ) {}

  /**
   * Creates all required folders and default view files.
   * Reports progress via Notice.
   */
  async scaffoldVault(): Promise<void> {
    await this.createFolders();
    await this.createDefaultViews();
    new Notice("Project Manager: Vault structure set up successfully.");
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async createFolders(): Promise<void> {
    const { folders } = this.settings;
    const paths = [
      folders.clients,
      folders.engagements,
      folders.projects,
      folders.projectNotes,
      folders.people,
      folders.inbox,
      folders.meetings,
      folders.dailyNotes,
      folders.utility,
    ];

    for (const path of paths) {
      await ensureFolderExists(this.app, path);
    }
  }

  private async createDefaultViews(): Promise<void> {
    const views: Array<{ path: string; content: string }> = [
      {
        path: "views/Task Dashboard.md",
        content: this.taskDashboardContent(),
      },
      {
        path: "views/Tasks By Project.md",
        content: this.tasksByProjectContent(),
      },
      {
        path: "views/Clients.md",
        content: this.clientsContent(),
      },
      {
        path: "views/Engagements.md",
        content: this.engagementsContent(),
      },
      {
        path: "views/Projects.md",
        content: this.projectsContent(),
      },
      {
        path: "views/Inbox.md",
        content: this.inboxContent(),
      },
    ];

    await ensureFolderExists(this.app, "views");

    for (const view of views) {
      const exists = await this.app.vault.adapter.exists(view.path);
      if (!exists) {
        await this.app.vault.create(view.path, view.content);
      }
    }
  }

  // ─── Default view content ─────────────────────────────────────────────────

  private taskDashboardContent(): string {
    return `---
obsidianUIMode: preview
---
# Task Dashboard

\`\`\`pm-tasks
mode: dashboard
\`\`\`
`;
  }

  private tasksByProjectContent(): string {
    return `---
obsidianUIMode: preview
---
# Tasks By Project

\`\`\`pm-tasks
mode: by-project
\`\`\`
`;
  }

  private clientsContent(): string {
    return `---
obsidianUIMode: preview
---
# Clients

\`\`\`dataview
TABLE status, contact-name
FROM #client
SORT status ASC, file.name ASC
\`\`\`
`;
  }

  private engagementsContent(): string {
    return `---
obsidianUIMode: preview
---
# Engagements

\`\`\`dataview
TABLE client, status, start-date, end-date
FROM #engagement
SORT status ASC, start-date DESC
\`\`\`
`;
  }

  private projectsContent(): string {
    return `---
obsidianUIMode: preview
---
# Projects

\`\`\`dataview
TABLE engagement, status, priority, start-date
FROM #project
SORT status ASC, priority ASC
\`\`\`
`;
  }

  private inboxContent(): string {
    return `---
obsidianUIMode: preview
---
# Inbox

\`\`\`dataview
TABLE engagement, status
FROM "inbox"
WHERE status != "Inactive"
SORT file.mtime DESC
\`\`\`
`;
  }
}
