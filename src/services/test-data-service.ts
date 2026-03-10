import { App, TFile } from "obsidian";
import type { ProjectManagerSettings } from "../settings";
import type { ITemplateService, ILoggerService, ITestDataService, TestDataResult } from "./interfaces";
import {
  ensureFolderExists,
  resolveConflictPath,
  generateProjectNotesPath,
} from "../utils/path-utils";
import { toWikilink } from "../utils/link-utils";
import { todayISO } from "../utils/date-utils";
import { FM_KEY, NOTES_MARKER, MD_EXTENSION } from "../constants";
import {
  TEST_PREFIX,
  CLIENT_NAMES,
  ENGAGEMENT_NAMES,
  PROJECT_NAMES,
  PERSON_NAMES,
  INBOX_NAMES,
  SINGLE_MEETING_NAMES,
  RECURRING_MEETING_NAMES,
  PROJECT_NOTE_NAMES,
  TASK_DESCRIPTIONS,
  PRIORITY_EMOJIS,
  TASKS_PER_ENTITY,
} from "./test-data-constants";
import type { EntityType } from "../types";

/** Tracks a project's name and its parent engagement for note generation. */
interface ProjectRecord {
  name: string;
  engagementName: string;
}

/**
 * Generates test/demo data across all entity types.
 *
 * All generated files are prefixed with TEST_PREFIX ("[TEST]") so they can be
 * identified and removed without touching real vault content.
 *
 * Generation order is parent-first to ensure foreign-key relationships are valid:
 *   clients → people, engagements → projects, inbox, meetings → project notes, events
 */
export class TestDataService implements ITestDataService {
  constructor(
    private readonly app: App,
    private readonly settings: ProjectManagerSettings,
    private readonly templateService: ITemplateService,
    private readonly loggerService: ILoggerService
  ) {}

  // ─── Public API ───────────────────────────────────────────────────────────

  async generateTestData(): Promise<TestDataResult> {
    const errors: string[] = [];

    this.loggerService.info("Starting test data generation", "TestDataService");

    const clientNames = await this.generateClients(errors);
    const personNames = await this.generatePeople(errors, clientNames);
    const engagementNames = await this.generateEngagements(errors, clientNames);
    const projectRecords = await this.generateProjects(errors, engagementNames);
    const projectNames = projectRecords.map((p) => p.name);
    const inboxNames = await this.generateInbox(errors, engagementNames);
    const singleMeetingNames = await this.generateSingleMeetings(errors, engagementNames);
    const recurringMeetingNames = await this.generateRecurringMeetings(errors, engagementNames);
    const projectNoteNames = await this.generateProjectNotes(errors, projectRecords);
    const eventNames = await this.generateRecurringMeetingEvents(errors, recurringMeetingNames);

    const totalFiles =
      clientNames.length +
      personNames.length +
      engagementNames.length +
      projectNames.length +
      inboxNames.length +
      singleMeetingNames.length +
      recurringMeetingNames.length +
      projectNoteNames.length +
      eventNames.length;

    const totalTasks = totalFiles * TASKS_PER_ENTITY;

    this.loggerService.info(
      `Test data generation complete: ${totalFiles} files, ${totalTasks} tasks, ${errors.length} errors`,
      "TestDataService"
    );

    return { totalFiles, totalTasks, errors };
  }

  async cleanTestData(): Promise<number> {
    const testFiles = this.app.vault
      .getMarkdownFiles()
      .filter((f) => f.basename.startsWith(TEST_PREFIX));

    for (const file of testFiles) {
      try {
        await this.app.vault.delete(file);
      } catch (err) {
        this.loggerService.error(
          `Failed to delete test file: ${file.path}`,
          "TestDataService",
          err
        );
      }
    }

    this.loggerService.info(`Cleaned ${testFiles.length} test files`, "TestDataService");
    return testFiles.length;
  }

  // ─── Entity generators ────────────────────────────────────────────────────

  private async generateClients(errors: string[]): Promise<string[]> {
    const names: string[] = [];
    for (const baseName of CLIENT_NAMES) {
      const name = `${TEST_PREFIX} ${baseName}`;
      try {
        await this.createEntityFile("client", name, this.settings.folders.clients);
        names.push(name);
      } catch (err) {
        errors.push(`Client "${name}": ${String(err)}`);
        this.loggerService.error(`Failed to create client: ${name}`, "TestDataService", err);
      }
    }
    return names;
  }

  private async generatePeople(errors: string[], clientNames: string[]): Promise<string[]> {
    const names: string[] = [];
    for (let i = 0; i < PERSON_NAMES.length; i++) {
      const name = `${TEST_PREFIX} ${PERSON_NAMES[i]}`;
      const clientName = this.roundRobin(clientNames, i);
      try {
        await this.createEntityFile(
          "person",
          name,
          this.settings.folders.people,
          {},
          clientName
            ? (fm) => {
                fm[FM_KEY.CLIENT] = toWikilink(clientName);
              }
            : undefined
        );
        names.push(name);
      } catch (err) {
        errors.push(`Person "${name}": ${String(err)}`);
        this.loggerService.error(`Failed to create person: ${name}`, "TestDataService", err);
      }
    }
    return names;
  }

  private async generateEngagements(errors: string[], clientNames: string[]): Promise<string[]> {
    const names: string[] = [];
    for (let i = 0; i < ENGAGEMENT_NAMES.length; i++) {
      const name = `${TEST_PREFIX} ${ENGAGEMENT_NAMES[i]}`;
      const clientName = this.roundRobin(clientNames, i);
      try {
        await this.createEntityFile(
          "engagement",
          name,
          this.settings.folders.engagements,
          {},
          clientName
            ? (fm) => {
                fm[FM_KEY.CLIENT] = toWikilink(clientName);
              }
            : undefined
        );
        names.push(name);
      } catch (err) {
        errors.push(`Engagement "${name}": ${String(err)}`);
        this.loggerService.error(`Failed to create engagement: ${name}`, "TestDataService", err);
      }
    }
    return names;
  }

  private async generateProjects(
    errors: string[],
    engagementNames: string[]
  ): Promise<ProjectRecord[]> {
    const records: ProjectRecord[] = [];
    for (let i = 0; i < PROJECT_NAMES.length; i++) {
      const name = `${TEST_PREFIX} ${PROJECT_NAMES[i]}`;
      const engagementName = this.roundRobin(engagementNames, i) ?? "";
      const notesDir = generateProjectNotesPath(name, this.settings.folders.projectNotes);
      try {
        await this.createEntityFile(
          "project",
          name,
          this.settings.folders.projects,
          { notesDir },
          engagementName
            ? (fm) => {
                fm[FM_KEY.ENGAGEMENT] = toWikilink(engagementName);
              }
            : undefined
        );
        records.push({ name, engagementName });
      } catch (err) {
        errors.push(`Project "${name}": ${String(err)}`);
        this.loggerService.error(`Failed to create project: ${name}`, "TestDataService", err);
      }
    }
    return records;
  }

  private async generateInbox(errors: string[], engagementNames: string[]): Promise<string[]> {
    const names: string[] = [];
    for (let i = 0; i < INBOX_NAMES.length; i++) {
      const name = `${TEST_PREFIX} ${INBOX_NAMES[i]}`;
      const engagementName = this.roundRobin(engagementNames, i);
      try {
        await this.createEntityFile(
          "inbox",
          name,
          this.settings.folders.inbox,
          {},
          engagementName
            ? (fm) => {
                fm[FM_KEY.ENGAGEMENT] = toWikilink(engagementName);
              }
            : undefined
        );
        names.push(name);
      } catch (err) {
        errors.push(`Inbox "${name}": ${String(err)}`);
        this.loggerService.error(`Failed to create inbox note: ${name}`, "TestDataService", err);
      }
    }
    return names;
  }

  private async generateSingleMeetings(
    errors: string[],
    engagementNames: string[]
  ): Promise<string[]> {
    const names: string[] = [];
    for (let i = 0; i < SINGLE_MEETING_NAMES.length; i++) {
      const name = `${TEST_PREFIX} ${SINGLE_MEETING_NAMES[i]}`;
      const engagementName = this.roundRobin(engagementNames, i);
      try {
        await this.createEntityFile(
          "single-meeting",
          name,
          this.settings.folders.meetingsSingle,
          {},
          engagementName
            ? (fm) => {
                fm[FM_KEY.ENGAGEMENT] = toWikilink(engagementName);
              }
            : undefined
        );
        names.push(name);
      } catch (err) {
        errors.push(`Single meeting "${name}": ${String(err)}`);
        this.loggerService.error(
          `Failed to create single meeting: ${name}`,
          "TestDataService",
          err
        );
      }
    }
    return names;
  }

  private async generateRecurringMeetings(
    errors: string[],
    engagementNames: string[]
  ): Promise<string[]> {
    const names: string[] = [];
    for (let i = 0; i < RECURRING_MEETING_NAMES.length; i++) {
      const name = `${TEST_PREFIX} ${RECURRING_MEETING_NAMES[i]}`;
      const engagementName = this.roundRobin(engagementNames, i);
      try {
        await this.createEntityFile(
          "recurring-meeting",
          name,
          this.settings.folders.meetingsRecurring,
          {},
          engagementName
            ? (fm) => {
                fm[FM_KEY.ENGAGEMENT] = toWikilink(engagementName);
              }
            : undefined
        );
        names.push(name);
      } catch (err) {
        errors.push(`Recurring meeting "${name}": ${String(err)}`);
        this.loggerService.error(
          `Failed to create recurring meeting: ${name}`,
          "TestDataService",
          err
        );
      }
    }
    return names;
  }

  private async generateProjectNotes(
    errors: string[],
    projectRecords: ProjectRecord[]
  ): Promise<string[]> {
    const names: string[] = [];
    for (let i = 0; i < PROJECT_NOTE_NAMES.length; i++) {
      const noteName = `${TEST_PREFIX} ${PROJECT_NOTE_NAMES[i]}`;
      const project = this.roundRobin(projectRecords, i);
      if (!project) {
        errors.push(`Project note "${noteName}": no parent project available`);
        continue;
      }
      const notesDir = generateProjectNotesPath(project.name, this.settings.folders.projectNotes);
      try {
        await this.createEntityFile(
          "project-note",
          noteName,
          notesDir,
          { relatedProject: project.name },
          (fm) => {
            if (project.engagementName) {
              fm[FM_KEY.ENGAGEMENT] = toWikilink(project.engagementName);
            }
            fm[FM_KEY.RELATED_PROJECT] = toWikilink(project.name);
          }
        );
        names.push(noteName);
      } catch (err) {
        errors.push(`Project note "${noteName}": ${String(err)}`);
        this.loggerService.error(
          `Failed to create project note: ${noteName}`,
          "TestDataService",
          err
        );
      }
    }
    return names;
  }

  private async generateRecurringMeetingEvents(
    errors: string[],
    meetingNames: string[]
  ): Promise<string[]> {
    const names: string[] = [];
    const eventDate = todayISO();
    for (let i = 0; i < meetingNames.length && i < 10; i++) {
      const meetingName = meetingNames[i];
      const eventFolder = `${this.settings.folders.meetingsRecurringEvents}/${meetingName}`;
      try {
        await this.createEntityFile(
          "recurring-meeting-event",
          eventDate,
          eventFolder,
          {},
          (fm) => {
            fm[FM_KEY.RECURRING_MEETING] = toWikilink(meetingName);
          }
        );
        names.push(`${eventFolder}/${eventDate}`);
      } catch (err) {
        errors.push(`Recurring meeting event for "${meetingName}": ${String(err)}`);
        this.loggerService.error(
          `Failed to create recurring meeting event for: ${meetingName}`,
          "TestDataService",
          err
        );
      }
    }
    return names;
  }

  // ─── File creation helpers ────────────────────────────────────────────────

  /**
   * Creates a single entity file with template content and injected tasks.
   * Optionally applies frontmatter overrides via processFrontMatter.
   */
  private async createEntityFile(
    type: EntityType,
    name: string,
    folder: string,
    extraVars: Record<string, string> = {},
    frontmatterOverrides?: (fm: Record<string, unknown>) => void
  ): Promise<TFile> {
    await ensureFolderExists(this.app, folder);

    const basePath = `${folder}/${name}${MD_EXTENSION}`;
    const path = await resolveConflictPath(this.app, basePath);

    const vars: Record<string, string> = {
      ...this.templateService.defaultVars(),
      name,
      ...extraVars,
    };

    const rawContent = this.templateService.processTemplate(
      this.templateService.getTemplate(type),
      vars
    );

    const taskBlock = this.generateTaskBlock();
    const content = this.injectTasksIntoContent(rawContent, taskBlock);

    const file = await this.app.vault.create(path, content);

    if (frontmatterOverrides) {
      await this.app.fileManager.processFrontMatter(
        file,
        frontmatterOverrides as (fm: Record<string, unknown>) => void
      );
    }

    return file;
  }

  // ─── Task generation ──────────────────────────────────────────────────────

  /** Generates TASKS_PER_ENTITY task lines as a single string block. */
  private generateTaskBlock(): string {
    const lines: string[] = [];
    for (let i = 0; i < TASKS_PER_ENTITY; i++) {
      const description = this.randomFrom([...TASK_DESCRIPTIONS]);
      const priorityIndex = Math.floor(Math.random() * PRIORITY_EMOJIS.length);
      const emoji = PRIORITY_EMOJIS[priorityIndex];
      const dueDate = this.generateDueDate(i);
      lines.push(this.formatTaskLine(description, emoji, dueDate));
    }
    return lines.join("\n") + "\n";
  }

  /** Formats a single task line in Tasks plugin format. */
  private formatTaskLine(description: string, emoji: string, dueDate: string): string {
    const emojiPart = emoji ? ` ${emoji}` : "";
    return `- [ ] ${description}${emojiPart} 📅 ${dueDate}`;
  }

  /**
   * Produces a due date offset from today.
   * Indices 0–1 → past (1–30 days ago); indices 2–4 → future (1–30 days ahead).
   */
  private generateDueDate(index: number): string {
    const today = new Date();
    const offset = index <= 1 ? -(1 + Math.floor(Math.random() * 30)) : 1 + Math.floor(Math.random() * 30);
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /**
   * Injects a task block into file content at the # Notes section.
   * - WITH_DASH (`# Notes\n-`): replaces the dash marker
   * - BASE (`# Notes\n`): inserts tasks after the heading
   * - No heading: appends a new # Notes section at the end
   */
  private injectTasksIntoContent(content: string, taskBlock: string): string {
    if (content.includes(NOTES_MARKER.WITH_DASH)) {
      return content.replace(NOTES_MARKER.WITH_DASH, `# Notes\n${taskBlock}`);
    }
    if (content.includes(NOTES_MARKER.BASE)) {
      return content.replace(NOTES_MARKER.BASE, `# Notes\n${taskBlock}\n`);
    }
    return `${content}\n# Notes\n${taskBlock}`;
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private randomFrom<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /** Returns `arr[index % arr.length]`, or undefined if the array is empty. */
  private roundRobin<T>(arr: T[], index: number): T | undefined {
    if (arr.length === 0) return undefined;
    return arr[index % arr.length];
  }
}
