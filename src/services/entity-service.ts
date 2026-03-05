import { App, Notice, TFile } from "obsidian";
import type { EntityType, CreateFileResult } from "../types";
import type { ProjectManagerSettings } from "../settings";
import type { IEntityService } from "./interfaces";
import type { ITemplateService } from "./interfaces";
import {
  ensureFolderExists,
  resolveConflictPath,
  generateProjectNotesPath,
} from "../utils/path-utils";
import { toWikilink, normalizeToName } from "../utils/link-utils";
import { getFrontmatter } from "../utils/frontmatter-utils";
import { STATUS } from "../constants";

/**
 * Handles all entity creation and modification operations.
 *
 * Responsibilities:
 * - Generate file content from TemplateService
 * - Resolve conflict-free paths
 * - Create folders as needed
 * - Set frontmatter values via processFrontMatter
 * - Open newly created files in a new tab
 */
export class EntityService implements IEntityService {
  constructor(
    private readonly app: App,
    private readonly settings: ProjectManagerSettings,
    private readonly templates: ITemplateService
  ) {}

  // ─── Entity creation ─────────────────────────────────────────────────────

  /** Creates a new client note in the clients folder. */
  async createClient(name: string): Promise<TFile> {
    const file = await this.createEntity("client", name, this.settings.folders.clients);
    await this.openFile(file);
    return file;
  }

  /** Creates a new engagement note, optionally linked to a client. */
  async createEngagement(name: string, clientName?: string): Promise<TFile> {
    const file = await this.createEntity("engagement", name, this.settings.folders.engagements, {
      date: this.today(),
    });
    if (clientName) {
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        fm["client"] = toWikilink(clientName);
      });
    }
    await this.openFile(file);
    return file;
  }

  /**
   * Creates a new project note with auto-generated notesDirectory.
   * Optionally links to an engagement.
   */
  async createProject(name: string, engagementName?: string): Promise<TFile> {
    const notesDir = generateProjectNotesPath(name, this.settings.folders.projectNotes);
    const file = await this.createEntity("project", name, this.settings.folders.projects, {
      notesDir,
    });
    if (engagementName) {
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        fm["engagement"] = toWikilink(engagementName);
      });
    }
    await this.openFile(file);
    return file;
  }

  /** Creates a new person note, optionally linked to a client. */
  async createPerson(name: string, clientName?: string): Promise<TFile> {
    const file = await this.createEntity("person", name, this.settings.folders.people);
    if (clientName) {
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        fm["client"] = toWikilink(clientName);
      });
    }
    await this.openFile(file);
    return file;
  }

  /** Creates a new inbox note, optionally linked to an engagement. */
  async createInboxNote(name: string, engagementName?: string): Promise<TFile> {
    const file = await this.createEntity("inbox", name, this.settings.folders.inbox);
    if (engagementName) {
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        fm["engagement"] = toWikilink(engagementName);
      });
    }
    await this.openFile(file);
    return file;
  }

  /** Creates a single meeting note, optionally linked to an engagement. */
  async createSingleMeeting(name: string, engagementName?: string): Promise<TFile> {
    const file = await this.createEntity(
      "single-meeting",
      name,
      this.settings.folders.meetingsSingle
    );
    if (engagementName) {
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        fm["engagement"] = toWikilink(engagementName);
      });
    }
    await this.openFile(file);
    return file;
  }

  /** Creates a recurring meeting note, optionally linked to an engagement. */
  async createRecurringMeeting(name: string, engagementName?: string): Promise<TFile> {
    const file = await this.createEntity(
      "recurring-meeting",
      name,
      this.settings.folders.meetingsRecurring
    );
    if (engagementName) {
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        fm["engagement"] = toWikilink(engagementName);
      });
    }
    await this.openFile(file);
    return file;
  }

  /**
   * Creates a project note in the project's notesDirectory.
   * The active file must be a project with a notesDirectory frontmatter property.
   */
  async createProjectNote(projectFile: TFile, noteName: string): Promise<TFile> {
    const fm = getFrontmatter(this.app, projectFile);
    const notesDir = fm.notesDirectory as string | undefined;

    if (!notesDir) {
      throw new Error(
        `Project "${projectFile.basename}" does not have a notesDirectory property.`
      );
    }

    const engagementName = normalizeToName(fm.engagement);

    await ensureFolderExists(this.app, notesDir);

    const basePath = `${notesDir}/${noteName}.md`;
    const path = await resolveConflictPath(this.app, basePath);

    const vars = {
      ...this.templates.defaultVars(),
      relatedProject: projectFile.basename,
    };

    const content = this.templates.processTemplate(
      this.templates.getTemplate("project-note"),
      vars
    );

    const newFile = await this.app.vault.create(path, content);
    if (engagementName) {
      await this.app.fileManager.processFrontMatter(newFile, (pfm: Record<string, unknown>) => {
        pfm["engagement"] = toWikilink(engagementName);
      });
    }
    await this.openFile(newFile);
    return newFile;
  }

  /**
   * Creates a new recurring meeting event note in a subfolder named after the parent meeting.
   * The event file name is YYYY-MM-DD (today's date), with a numeric suffix for same-day conflicts.
   * Copies default-attendees from the parent recurring meeting unless overridden in options.
   */
  async createRecurringMeetingEvent(
    meetingName: string,
    options?: { date?: string; attendees?: string[]; notesContent?: string; open?: boolean }
  ): Promise<TFile> {
    // Step 1: Determine event date (ISO date only, first 10 chars).
    const rawDate = options?.date ?? this.today();
    const dateStr = rawDate.slice(0, 10);

    // Step 2: Determine event folder (base events folder / meeting name).
    const eventFolder = `${this.settings.folders.meetingsRecurringEvents}/${meetingName}`;

    // Step 3 & 4: Look up parent meeting frontmatter to get default-attendees.
    const parentPath = `${this.settings.folders.meetingsRecurring}/${meetingName}.md`;
    const parentAbstract = this.app.vault.getAbstractFileByPath(parentPath);
    let parentDefaultAttendees: unknown[] = [];
    if (parentAbstract instanceof TFile) {
      const cache = this.app.metadataCache.getFileCache(parentAbstract);
      const rawAttendees: unknown = cache?.frontmatter?.["default-attendees"];
      if (Array.isArray(rawAttendees)) {
        parentDefaultAttendees = rawAttendees;
      }
    }

    // Step 5: Determine attendees wikilinks.
    let attendees: string[];
    if (options?.attendees !== undefined) {
      // Caller provided explicit attendee names — convert to wikilinks.
      attendees = options.attendees.map((name) => toWikilink(name));
    } else {
      // Copy default-attendees from parent, normalising each value to a plain name.
      attendees = parentDefaultAttendees
        .map((val) => normalizeToName(val))
        .filter((name): name is string => name !== null)
        .map((name) => toWikilink(name));
    }

    // Step 6: Create the entity file.
    const file = await this.createEntity("recurring-meeting-event", dateStr, eventFolder);

    // Step 7: Set frontmatter.
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      fm["recurring-meeting"] = toWikilink(meetingName);
      fm["attendees"] = attendees;
    });

    // Step 8: Inject notes content if provided.
    if (options?.notesContent) {
      const content = await this.app.vault.read(file);
      let updated: string;
      if (content.includes("# Notes\n-")) {
        updated = content.replace("# Notes\n-", `# Notes\n${options.notesContent}`);
      } else if (content.includes("# Notes\n")) {
        updated = content.replace("# Notes\n", `# Notes\n${options.notesContent}\n`);
      } else {
        updated = content;
      }
      await this.app.vault.modify(file, updated);
    }

    // Step 9: Open the newly created file (skipped when called internally with open: false).
    if (options?.open !== false) {
      await this.openFile(file);
    }

    // Step 10: Return the file.
    return file;
  }

  /**
   * Converts an inbox note to a project.
   *
   * Creates a new project file with:
   * - `convertedFrom` pointing back to the inbox note
   * - Engagement inherited from the inbox note
   *
   * Updates the inbox note's frontmatter:
   * - `status` → "Inactive"
   * - `convertedTo` → link to the new project
   */
  async convertInboxToProject(inboxFile: TFile, projectName?: string): Promise<TFile> {
    const name = projectName ?? inboxFile.basename;
    const fm = getFrontmatter(this.app, inboxFile);
    const inboxEngagement = normalizeToName(fm.engagement) ?? undefined;

    const projectFile = await this.createProject(name, inboxEngagement);

    // Set bidirectional links
    await this.app.fileManager.processFrontMatter(projectFile, (pfm: Record<string, unknown>) => {
      pfm["convertedFrom"] = toWikilink(`${this.settings.folders.inbox}/${inboxFile.basename}`);
    });

    await this.app.fileManager.processFrontMatter(inboxFile, (ifm: Record<string, unknown>) => {
      ifm["status"] = STATUS.INACTIVE;
      ifm["convertedTo"] = toWikilink(
        `${this.settings.folders.projects}/${projectFile.basename}`
      );
    });

    return projectFile;
  }

  /**
   * Converts a single meeting note into a recurring meeting + its first event.
   *
   * Steps:
   * 1. Read single meeting frontmatter: engagement, date, attendees
   * 2. Read file content and extract Notes section
   * 3. Create recurring meeting with the given name and same engagement
   * 4. Set default-attendees on the recurring meeting from the single meeting's attendees
   * 5. Create first event with date and attendees from single meeting + notes content
   * 6. Delete the original single meeting file
   */
  async convertSingleToRecurring(singleFile: TFile, recurringName?: string): Promise<TFile> {
    const name = recurringName ?? singleFile.basename;
    const fm = getFrontmatter(this.app, singleFile);
    const engagementName = normalizeToName(fm.engagement) ?? undefined;

    // Extract attendees from the single meeting
    const rawAttendees = fm.attendees;
    const singleAttendees = Array.isArray(rawAttendees)
      ? rawAttendees.map((a) => normalizeToName(a) ?? String(a)).filter(Boolean)
      : [];

    // Extract Notes section from file content
    const content = await this.app.vault.read(singleFile);
    const notesIdx = content.indexOf("\n# Notes");
    const notesContent =
      notesIdx >= 0
        ? content
            .slice(notesIdx + "\n# Notes".length)
            .replace(/^\n-(?= *\n|$)/, "")
            .trim()
        : "";

    // Extract date from single meeting (may be datetime string)
    const singleDate = String(fm.date ?? "").slice(0, 10) || undefined;

    // Create the recurring meeting (this calls openFile internally)
    const recurringFile = await this.createRecurringMeeting(name, engagementName);

    // Set default-attendees on the recurring meeting
    if (singleAttendees.length > 0) {
      await this.app.fileManager.processFrontMatter(recurringFile, (pfm: Record<string, unknown>) => {
        pfm["default-attendees"] = singleAttendees.map((a) => toWikilink(a));
      });
    }

    // Create the first event with data from single meeting.
    // open: false — the recurring meeting is already open, so we don't open a second tab.
    await this.createRecurringMeetingEvent(name, {
      date: singleDate,
      attendees: singleAttendees,
      notesContent: notesContent || undefined,
      open: false,
    });

    // Delete the original single meeting
    await this.app.vault.delete(singleFile);

    return recurringFile;
  }

  // ─── Generic creation ────────────────────────────────────────────────────

  /**
   * Generic entity creation: resolves path, creates folder, renders template, creates file.
   */
  private async createEntity(
    type: EntityType,
    name: string,
    folder: string,
    extraVars: Record<string, string> = {}
  ): Promise<TFile> {
    await ensureFolderExists(this.app, folder);

    const basePath = `${folder}/${name}.md`;
    const path = await resolveConflictPath(this.app, basePath);

    const vars: Record<string, string> = {
      ...this.templates.defaultVars(),
      name,
      ...extraVars,
    };

    const content = this.templates.processTemplate(
      this.templates.getTemplate(type),
      vars
    );

    const file = await this.app.vault.create(path, content);
    new Notice(`Created: ${name}`);
    return file;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async openFile(file: TFile): Promise<void> {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file);
  }

  private today(): string {
    return new Date().toISOString().split("T")[0];
  }

  /** Validates that a create operation result is safe to use. */
  validateResult(result: CreateFileResult): void {
    if (!result.success) {
      throw new Error(result.error ?? "Entity creation failed");
    }
  }
}
