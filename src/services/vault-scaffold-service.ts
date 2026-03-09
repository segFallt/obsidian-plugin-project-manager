import { App, Notice } from "obsidian";
import type { ProjectManagerSettings } from "../settings";
import { ensureFolderExists } from "../utils/path-utils";
import type { IScaffoldService } from "./interfaces";

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
      { path: "views/Task Dashboard.md", content: this.taskDashboardContent() },
      { path: "views/Tasks By Project.md", content: this.tasksByProjectContent() },

      // .base files (Obsidian Bases)
      { path: "views/Clients Base.base", content: this.clientsBaseContent(f.clients) },
      { path: "views/Engagements Base.base", content: this.engagementsBaseContent(f.engagements) },
      { path: "views/Projects Base.base", content: this.projectsBaseContent(f.projects) },
      { path: "views/People Base.base", content: this.peopleBaseContent(f.people) },
      { path: "views/Inbox Base.base", content: this.inboxBaseContent(f.inbox) },
      {
        path: "views/Single Meetings Base.base",
        content: this.singleMeetingsBaseContent(f.meetingsSingle),
      },
      {
        path: "views/Recurring Meetings Base.base",
        content: this.recurringMeetingsBaseContent(f.meetingsRecurring),
      },

      // Entity view .md files
      { path: "views/Clients.md", content: this.clientsContent() },
      { path: "views/Engagements.md", content: this.engagementsContent() },
      { path: "views/Projects.md", content: this.projectsContent() },
      { path: "views/People.md", content: this.peopleContent() },
      { path: "views/Inbox.md", content: this.inboxContent() },
      { path: "views/Single Meeting.md", content: this.singleMeetingContent() },
      { path: "views/Recurring Meeting.md", content: this.recurringMeetingContent() },
    ];

    await ensureFolderExists(this.app, "views");

    for (const file of files) {
      const exists = await this.app.vault.adapter.exists(file.path);
      if (!exists) {
        await this.app.vault.create(file.path, file.content);
      }
    }
  }

  // ─── Task view content ────────────────────────────────────────────────────

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

  // ─── .base file content ───────────────────────────────────────────────────

  private clientsBaseContent(folder: string): string {
    return `properties:
  file.name:
    displayName: Name
views:
  - type: table
    name: clients_active
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("client")
        - status == "Active"
    order:
      - file.name
      - contact-name
      - contact-email
    sort:
      - property: file.name
        direction: ASC
  - type: table
    name: clients_inactive
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("client")
        - status == "Inactive"
    order:
      - file.name
      - contact-name
      - contact-email
    sort:
      - property: file.name
        direction: ASC
`;
  }

  private engagementsBaseContent(folder: string): string {
    return `properties:
  file.name:
    displayName: Name
  client:
    displayName: Client
views:
  - type: table
    name: engagements_active
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("engagement")
        - status == "Active"
    order:
      - file.name
      - client
      - start-date
      - end-date
    sort:
      - property: file.name
        direction: ASC
  - type: table
    name: engagements_inactive
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("engagement")
        - status == "Inactive"
    order:
      - file.name
      - client
      - start-date
      - end-date
    sort:
      - property: file.name
        direction: ASC
`;
  }

  private projectsBaseContent(folder: string): string {
    return `properties:
  file.name:
    displayName: Title
views:
  - type: table
    name: projects_active
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("project")
        - status == "Active"
    order:
      - file.name
      - start-date
      - priority
      - engagement
      - file.mtime
    sort:
      - property: file.mtime
        direction: DESC
      - property: priority
        direction: ASC
      - property: start-date
        direction: DESC
  - type: table
    name: projects_new
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("project")
        - status == "New"
    order:
      - file.name
      - start-date
      - priority
      - file.mtime
      - engagement
    sort:
      - property: file.mtime
        direction: DESC
      - property: start-date
        direction: DESC
      - property: priority
        direction: ASC
  - type: table
    name: projects_onhold
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("project")
        - status == "On Hold"
    order:
      - file.name
      - start-date
      - priority
      - file.mtime
      - engagement
    sort:
      - property: file.name
        direction: ASC
      - property: file.mtime
        direction: DESC
      - property: priority
        direction: ASC
  - type: table
    name: projects_complete
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("project")
        - status == "Complete"
    order:
      - file.name
      - start-date
      - end-date
      - priority
      - file.mtime
      - engagement
    sort:
      - property: file.mtime
        direction: DESC
      - property: file.name
        direction: ASC
      - property: end-date
        direction: DESC
`;
  }

  private peopleBaseContent(folder: string): string {
    return `properties:
  file.name:
    displayName: Name
views:
  - type: table
    name: people_active
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("person")
        - status == "Active"
    order:
      - file.name
      - title
      - client
    sort:
      - property: file.name
        direction: ASC
  - type: table
    name: people_all
    filters:
      and:
        - file.inFolder("${folder}")
        - file.hasTag("person")
    order:
      - file.name
      - title
      - status
      - client
    sort:
      - property: file.name
        direction: ASC
`;
  }

  private inboxBaseContent(folder: string): string {
    return `properties:
  file.name:
    displayName: Item
views:
  - type: table
    name: inbox_active
    filters:
      and:
        - file.inFolder("${folder}")
        - status == "Active"
    order:
      - file.name
      - engagement
      - file.ctime
      - file.mtime
    sort:
      - property: file.mtime
        direction: DESC
  - type: table
    name: inbox_inactive
    filters:
      and:
        - file.inFolder("${folder}")
        - status != "Active"
    order:
      - file.name
      - engagement
      - file.ctime
      - file.mtime
    sort:
      - property: file.mtime
        direction: ASC
      - property: engagement
        direction: ASC
`;
  }

  private singleMeetingsBaseContent(folder: string): string {
    return `properties:
  file.name:
    displayName: Meeting
views:
  - type: table
    name: meetings
    filters:
      and:
        - file.inFolder("${folder}")
    order:
      - file.name
      - engagement
      - date
    sort:
      - property: date
        direction: DESC
`;
  }

  private recurringMeetingsBaseContent(folder: string): string {
    return `properties:
  file.name:
    displayName: Meeting
views:
  - type: table
    name: meetings_active
    filters:
      and:
        - file.inFolder("${folder}")
        - and:
            - note["end-date"].isEmpty()
    order:
      - file.name
      - engagement
      - start-date
      - last-event-date
    sort:
      - property: last-event-date
        direction: DESC
  - type: table
    name: meetings_past
    filters:
      and:
        - and:
            - file.inFolder("${folder}")
            - '!note["end-date"].isEmpty()'
    order:
      - file.name
      - start-date
      - end-date
    sort:
      - property: end-date
        direction: DESC
`;
  }

  // ─── Entity view .md content ──────────────────────────────────────────────

  private clientsContent(): string {
    return `---
obsidianUIMode: preview
---
\`\`\`pm-actions
actions:
  - type: create-client
    label: New Client
    style: primary
\`\`\`

# Active Clients
![[Clients Base.base#clients_active]]

# Inactive Clients
![[Clients Base.base#clients_inactive]]
`;
  }

  private engagementsContent(): string {
    return `---
obsidianUIMode: preview
---
\`\`\`pm-actions
actions:
  - type: create-engagement
    label: New Engagement
    style: primary
\`\`\`

# Active Engagements
![[Engagements Base.base#engagements_active]]

# Inactive Engagements
![[Engagements Base.base#engagements_inactive]]
`;
  }

  private projectsContent(): string {
    return `---
obsidianUIMode: preview
---
\`\`\`pm-actions
actions:
  - type: create-project
    label: New Project
    style: primary
\`\`\`

# Active Projects
![[Projects Base.base#projects_active]]

# New Projects
![[Projects Base.base#projects_new]]

# On Hold Projects
![[Projects Base.base#projects_onhold]]

# Complete Projects
![[Projects Base.base#projects_complete]]
`;
  }

  private peopleContent(): string {
    return `---
obsidianUIMode: preview
---
\`\`\`pm-actions
actions:
  - type: create-person
    label: New Person
    style: primary
\`\`\`

# Active People
![[People Base.base#people_active]]

# All People
![[People Base.base#people_all]]
`;
  }

  private inboxContent(): string {
    return `---
obsidianUIMode: preview
---
\`\`\`pm-actions
actions:
  - type: create-inbox
    label: New Inbox Note
    style: primary
\`\`\`

# Active
![[Inbox Base.base#inbox_active]]

# Inactive
![[Inbox Base.base#inbox_inactive]]
`;
  }

  private singleMeetingContent(): string {
    return `---
obsidianUIMode: preview
---
\`\`\`pm-actions
actions:
  - type: create-single-meeting
    label: New Single Meeting
    style: primary
\`\`\`

![[Single Meetings Base.base#meetings]]
`;
  }

  private recurringMeetingContent(): string {
    return `---
obsidianUIMode: preview
---
\`\`\`pm-actions
actions:
  - type: create-recurring-meeting
    label: New Recurring Meeting
    style: primary
\`\`\`

# Active
![[Recurring Meetings Base.base#meetings_active]]

# Past
![[Recurring Meetings Base.base#meetings_past]]
`;
  }
}
