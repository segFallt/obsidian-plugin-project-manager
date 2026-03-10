import { App, Notice } from "obsidian";
import type { ProjectManagerSettings } from "../settings";
import { ensureFolderExists } from "../utils/path-utils";
import type { IScaffoldService } from "./interfaces";
import {
  SCAFFOLD_TASK_DASHBOARD,
  SCAFFOLD_TASKS_BY_PROJECT,
  SCAFFOLD_CLIENTS_MD,
  SCAFFOLD_ENGAGEMENTS_MD,
  SCAFFOLD_PROJECTS_MD,
  SCAFFOLD_PEOPLE_MD,
  SCAFFOLD_INBOX_MD,
  SCAFFOLD_SINGLE_MEETING_MD,
  SCAFFOLD_RECURRING_MEETING_MD,
  scaffoldClientsBase,
  scaffoldEngagementsBase,
  scaffoldProjectsBase,
  scaffoldPeopleBase,
  scaffoldInboxBase,
  scaffoldSingleMeetingsBase,
  scaffoldRecurringMeetingsBase,
} from "./scaffold-constants";

/**
 * Creates the full vault folder structure and default view files.
 *
 * Safe to run on an existing vault — existing files are not overwritten.
 * View files use Obsidian Bases (.base) for data tables and pm-actions for creation buttons.
 */
export class VaultScaffoldService implements IScaffoldService {
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
      folders.meetingsSingle,
      folders.meetingsRecurring,
      folders.dailyNotes,
      folders.utility,
    ];

    for (const path of paths) {
      await ensureFolderExists(this.app, path);
    }
  }

  private async createDefaultViews(): Promise<void> {
    const f = this.settings.folders;

    const files: Array<{ path: string; content: string }> = [
      // Task views (pm-tasks code blocks)
      { path: "views/Task Dashboard.md", content: SCAFFOLD_TASK_DASHBOARD },
      { path: "views/Tasks By Project.md", content: SCAFFOLD_TASKS_BY_PROJECT },

      // .base files (Obsidian Bases)
      { path: "views/Clients Base.base", content: scaffoldClientsBase(f.clients) },
      { path: "views/Engagements Base.base", content: scaffoldEngagementsBase(f.engagements) },
      { path: "views/Projects Base.base", content: scaffoldProjectsBase(f.projects) },
      { path: "views/People Base.base", content: scaffoldPeopleBase(f.people) },
      { path: "views/Inbox Base.base", content: scaffoldInboxBase(f.inbox) },
      { path: "views/Single Meetings Base.base", content: scaffoldSingleMeetingsBase(f.meetingsSingle) },
      { path: "views/Recurring Meetings Base.base", content: scaffoldRecurringMeetingsBase(f.meetingsRecurring) },

      // Entity view .md files
      { path: "views/Clients.md", content: SCAFFOLD_CLIENTS_MD },
      { path: "views/Engagements.md", content: SCAFFOLD_ENGAGEMENTS_MD },
      { path: "views/Projects.md", content: SCAFFOLD_PROJECTS_MD },
      { path: "views/People.md", content: SCAFFOLD_PEOPLE_MD },
      { path: "views/Inbox.md", content: SCAFFOLD_INBOX_MD },
      { path: "views/Single Meeting.md", content: SCAFFOLD_SINGLE_MEETING_MD },
      { path: "views/Recurring Meeting.md", content: SCAFFOLD_RECURRING_MEETING_MD },
    ];

    await ensureFolderExists(this.app, "views");

    for (const file of files) {
      const exists = await this.app.vault.adapter.exists(file.path);
      if (!exists) {
        await this.app.vault.create(file.path, file.content);
      }
    }
  }
}
