import { App, TFile } from "obsidian";
import type { ProjectManagerSettings } from "../settings";
import type { IEntityConversionService, IEntityCreationService } from "./interfaces";
import { toWikilink, normalizeToName } from "../utils/link-utils";
import { getFrontmatter } from "../utils/frontmatter-utils";
import { STATUS, FM_KEY, ISO_DATE_LENGTH, NOTES_MARKER } from "../constants";

/**
 * Handles entity conversion operations.
 *
 * Responsibilities:
 * - Convert inbox notes to projects
 * - Convert single meetings to recurring meetings with a first event
 */
export class EntityConversionService implements IEntityConversionService {
  constructor(
    private readonly app: App,
    private readonly settings: ProjectManagerSettings,
    private readonly creation: IEntityCreationService
  ) {}

  /**
   * Converts an inbox note to a project.
   *
   * Creates a new project file with:
   * - `convertedFrom` pointing back to the inbox note
   * - Engagement inherited from the inbox note
   *
   * Updates the inbox note's frontmatter:
   * - `status` → "Complete"
   * - `convertedTo` → link to the new project
   */
  async convertInboxToProject(inboxFile: TFile, projectName?: string): Promise<TFile> {
    const name = projectName ?? inboxFile.basename;
    const fm = getFrontmatter(this.app, inboxFile);
    const inboxEngagement = normalizeToName(fm[FM_KEY.ENGAGEMENT]) ?? undefined;

    const projectFile = await this.creation.createProject(name, inboxEngagement);

    await this.app.fileManager.processFrontMatter(projectFile, (pfm: Record<string, unknown>) => {
      pfm[FM_KEY.CONVERTED_FROM] = toWikilink(`${this.settings.folders.inbox}/${inboxFile.basename}`);
    });

    await this.app.fileManager.processFrontMatter(inboxFile, (ifm: Record<string, unknown>) => {
      ifm[FM_KEY.STATUS] = STATUS.COMPLETE;
      ifm[FM_KEY.CONVERTED_TO] = toWikilink(
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
    const engagementName = normalizeToName(fm[FM_KEY.ENGAGEMENT]) ?? undefined;

    const rawAttendees = fm[FM_KEY.ATTENDEES];
    const singleAttendees = Array.isArray(rawAttendees)
      ? rawAttendees.map((a) => normalizeToName(a) ?? String(a)).filter(Boolean)
      : [];

    const content = await this.app.vault.read(singleFile);
    const notesIdx = content.indexOf(NOTES_MARKER.PREFIX);
    const notesContent =
      notesIdx >= 0
        ? content
            .slice(notesIdx + NOTES_MARKER.PREFIX.length)
            .replace(/^\n-(?= *\n|$)/, "")
            .trim()
        : "";

    const singleDate = String(fm[FM_KEY.DATE] ?? "").slice(0, ISO_DATE_LENGTH) || undefined;

    const recurringFile = await this.creation.createRecurringMeeting(name, engagementName);

    if (singleAttendees.length > 0) {
      await this.app.fileManager.processFrontMatter(recurringFile, (pfm: Record<string, unknown>) => {
        pfm[FM_KEY.DEFAULT_ATTENDEES] = singleAttendees.map((a) => toWikilink(a));
      });
    }

    // open: false — the recurring meeting is already open, so we don't open a second tab.
    await this.creation.createRecurringMeetingEvent(name, {
      date: singleDate,
      attendees: singleAttendees,
      notesContent: notesContent || undefined,
      open: false,
    });

    await this.app.vault.delete(singleFile);

    return recurringFile;
  }
}
