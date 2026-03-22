import { App, Notice, TFile } from "obsidian";
import type { EntityType, CreateFileResult } from "../types";
import type { ProjectManagerSettings } from "../settings";
import type { IEntityCreationService, ITemplateService, INavigationService } from "./interfaces";
import {
  ensureFolderExists,
  resolveConflictPath,
  generateProjectNotesPath,
} from "../utils/path-utils";
import { toWikilink, normalizeToName } from "../utils/link-utils";
import { getFrontmatter } from "../utils/frontmatter-utils";
import { FM_KEY, ISO_DATE_LENGTH, NOTES_MARKER, MD_EXTENSION } from "../constants";
import { todayISO } from "../utils/date-utils";

/**
 * Handles all entity creation operations.
 *
 * Responsibilities:
 * - Generate file content from TemplateService
 * - Resolve conflict-free paths
 * - Create folders as needed
 * - Set frontmatter values via processFrontMatter
 * - Open newly created files via NavigationService
 */
export class EntityCreationService implements IEntityCreationService {
  constructor(
    private readonly app: App,
    private readonly settings: ProjectManagerSettings,
    private readonly templates: ITemplateService,
    private readonly navigation: INavigationService
  ) {}

  // ─── Entity creation ─────────────────────────────────────────────────────

  async createClient(name: string): Promise<TFile> {
    const file = await this.createEntity("client", name, this.settings.folders.clients);
    await this.navigation.openFile(file);
    return file;
  }

  async createEngagement(name: string, clientName?: string): Promise<TFile> {
    const file = await this.createEntity("engagement", name, this.settings.folders.engagements, {
      date: todayISO(),
    });
    if (clientName) {
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        fm[FM_KEY.CLIENT] = toWikilink(clientName);
      });
    }
    await this.navigation.openFile(file);
    return file;
  }

  async createProject(name: string, engagementName?: string): Promise<TFile> {
    const notesDir = generateProjectNotesPath(name, this.settings.folders.projectNotes);
    const file = await this.createEntity("project", name, this.settings.folders.projects, {
      notesDir,
    });
    if (engagementName) {
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        fm[FM_KEY.ENGAGEMENT] = toWikilink(engagementName);
      });
    }
    await this.navigation.openFile(file);
    return file;
  }

  async createPerson(name: string, clientName?: string): Promise<TFile> {
    const file = await this.createEntity("person", name, this.settings.folders.people);
    if (clientName) {
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        fm[FM_KEY.CLIENT] = toWikilink(clientName);
      });
    }
    await this.navigation.openFile(file);
    return file;
  }

  async createRaidItem(name: string, raidType: string, engagement?: string, owner?: string): Promise<TFile> {
    const file = await this.createEntity("raid-item", name, this.settings.folders.raid);
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      fm["raid-type"] = raidType;
      fm["raised-date"] = new Date().toISOString().split("T")[0];
      fm["status"] = "Open";
      fm["likelihood"] = "Medium";
      fm["impact"] = "Medium";
      if (engagement) {
        fm[FM_KEY.ENGAGEMENT] = toWikilink(engagement);
      }
      if (owner) {
        fm["owner"] = toWikilink(owner);
      }
    });
    await this.navigation.openFile(file);
    return file;
  }

  async createInboxNote(name: string, engagementName?: string): Promise<TFile> {
    const file = await this.createEntity("inbox", name, this.settings.folders.inbox);
    if (engagementName) {
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        fm[FM_KEY.ENGAGEMENT] = toWikilink(engagementName);
      });
    }
    await this.navigation.openFile(file);
    return file;
  }

  async createSingleMeeting(name: string, engagementName?: string): Promise<TFile> {
    const file = await this.createEntity(
      "single-meeting",
      name,
      this.settings.folders.meetingsSingle
    );
    if (engagementName) {
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        fm[FM_KEY.ENGAGEMENT] = toWikilink(engagementName);
      });
    }
    await this.navigation.openFile(file);
    return file;
  }

  async createRecurringMeeting(name: string, engagementName?: string): Promise<TFile> {
    const file = await this.createEntity(
      "recurring-meeting",
      name,
      this.settings.folders.meetingsRecurring
    );
    if (engagementName) {
      await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
        fm[FM_KEY.ENGAGEMENT] = toWikilink(engagementName);
      });
    }
    await this.navigation.openFile(file);
    return file;
  }

  async createProjectNote(projectFile: TFile, noteName: string): Promise<TFile> {
    const fm = getFrontmatter(this.app, projectFile);
    const notesDir = fm[FM_KEY.NOTES_DIRECTORY] as string | undefined;

    if (!notesDir) {
      throw new Error(
        `Project "${projectFile.basename}" does not have a notesDirectory property.`
      );
    }

    const engagementName = normalizeToName(fm[FM_KEY.ENGAGEMENT]);

    await ensureFolderExists(this.app, notesDir);

    const basePath = `${notesDir}/${noteName}${MD_EXTENSION}`;
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
        pfm[FM_KEY.ENGAGEMENT] = toWikilink(engagementName);
      });
    }
    await this.navigation.openFile(newFile);
    return newFile;
  }

  async createRecurringMeetingEvent(
    meetingName: string,
    options?: { date?: string; attendees?: string[]; notesContent?: string; open?: boolean }
  ): Promise<TFile> {
    // Step 1: Determine event date (ISO date only, first 10 chars).
    const rawDate = options?.date ?? todayISO();
    const dateStr = rawDate.slice(0, ISO_DATE_LENGTH);

    // Step 2: Determine event folder (base events folder / meeting name).
    const eventFolder = `${this.settings.folders.meetingsRecurringEvents}/${meetingName}`;

    // Step 3 & 4: Look up parent meeting frontmatter to get default-attendees.
    const parentPath = `${this.settings.folders.meetingsRecurring}/${meetingName}${MD_EXTENSION}`;
    const parentAbstract = this.app.vault.getAbstractFileByPath(parentPath);
    let parentDefaultAttendees: unknown[] = [];
    if (parentAbstract instanceof TFile) {
      const cache = this.app.metadataCache.getFileCache(parentAbstract);
      const rawAttendees: unknown = cache?.frontmatter?.[FM_KEY.DEFAULT_ATTENDEES];
      if (Array.isArray(rawAttendees)) {
        parentDefaultAttendees = rawAttendees;
      }
    }

    // Step 5: Determine attendees wikilinks.
    let attendees: string[];
    if (options?.attendees !== undefined) {
      attendees = options.attendees.map((name) => toWikilink(name));
    } else {
      attendees = parentDefaultAttendees
        .map((val) => normalizeToName(val))
        .filter((name): name is string => name !== null)
        .map((name) => toWikilink(name));
    }

    // Step 6: Create the entity file.
    const file = await this.createEntity("recurring-meeting-event", dateStr, eventFolder);

    // Step 7: Set frontmatter.
    await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
      fm[FM_KEY.RECURRING_MEETING] = toWikilink(meetingName);
      fm[FM_KEY.ATTENDEES] = attendees;
    });

    // Step 7b: Update parent meeting's last-event-date.
    if (parentAbstract instanceof TFile) {
      await this.app.fileManager.processFrontMatter(parentAbstract, (pfm: Record<string, unknown>) => {
        pfm[FM_KEY.LAST_EVENT_DATE] = dateStr;
      });
    }

    // Step 8: Inject notes content if provided.
    if (options?.notesContent) {
      const content = await this.app.vault.read(file);
      let updated: string;
      if (content.includes(NOTES_MARKER.WITH_DASH)) {
        updated = content.replace(NOTES_MARKER.WITH_DASH, `# Notes\n${options.notesContent}`);
      } else if (content.includes(NOTES_MARKER.BASE)) {
        updated = content.replace(NOTES_MARKER.BASE, `# Notes\n${options.notesContent}\n`);
      } else {
        updated = content;
      }
      await this.app.vault.modify(file, updated);
    }

    // Step 9: Open the newly created file (skipped when called internally with open: false).
    if (options?.open !== false) {
      await this.navigation.openFile(file);
    }

    return file;
  }

  // ─── Generic creation ────────────────────────────────────────────────────

  async createEntity(
    type: EntityType,
    name: string,
    folder: string,
    extraVars: Record<string, string> = {}
  ): Promise<TFile> {
    await ensureFolderExists(this.app, folder);

    const basePath = `${folder}/${name}${MD_EXTENSION}`;
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

  // ─── Validation ──────────────────────────────────────────────────────────

  validateResult(result: CreateFileResult): void {
    if (!result.success) {
      throw new Error(result.error ?? "Entity creation failed");
    }
  }
}
