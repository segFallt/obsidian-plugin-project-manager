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
      ifm["status"] = "Inactive";
      ifm["convertedTo"] = toWikilink(
        `${this.settings.folders.projects}/${projectFile.basename}`
      );
    });

    return projectFile;
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
