import type { TFile } from "obsidian";
import type { CreateFileResult } from "../types";
import type {
  IEntityService,
  IEntityCreationService,
  IEntityConversionService,
} from "./interfaces";

/**
 * Facade delegating to EntityCreationService and EntityConversionService.
 *
 * Kept as a single entry point for the DI wiring layer (main.ts) and for
 * consumers that need both creation and conversion capabilities.
 * All logic lives in the two sub-services.
 */
export class EntityService implements IEntityService {
  constructor(
    private readonly creation: IEntityCreationService,
    private readonly conversion: IEntityConversionService
  ) {}

  // ─── Creation delegation ─────────────────────────────────────────────────

  createClient(name: string): Promise<TFile> {
    return this.creation.createClient(name);
  }

  createEngagement(name: string, clientName?: string): Promise<TFile> {
    return this.creation.createEngagement(name, clientName);
  }

  createProject(name: string, engagementName?: string): Promise<TFile> {
    return this.creation.createProject(name, engagementName);
  }

  createPerson(name: string, clientName?: string): Promise<TFile> {
    return this.creation.createPerson(name, clientName);
  }

  createInboxNote(name: string, engagementName?: string): Promise<TFile> {
    return this.creation.createInboxNote(name, engagementName);
  }

  createSingleMeeting(name: string, engagementName?: string): Promise<TFile> {
    return this.creation.createSingleMeeting(name, engagementName);
  }

  createRecurringMeeting(name: string, engagementName?: string): Promise<TFile> {
    return this.creation.createRecurringMeeting(name, engagementName);
  }

  createProjectNote(projectFile: TFile, noteName: string): Promise<TFile> {
    return this.creation.createProjectNote(projectFile, noteName);
  }

  createRecurringMeetingEvent(
    meetingName: string,
    options?: { date?: string; attendees?: string[]; notesContent?: string; open?: boolean }
  ): Promise<TFile> {
    return this.creation.createRecurringMeetingEvent(meetingName, options);
  }

  createRaidItem(name: string, raidType: string, engagement?: string, owner?: string): Promise<TFile> {
    return this.creation.createRaidItem(name, raidType, engagement, owner);
  }

  createReferenceTopic(name: string, parentName?: string): Promise<TFile> {
    return this.creation.createReferenceTopic(name, parentName);
  }

  createReference(name: string, topics: string[], client?: string, engagement?: string): Promise<TFile> {
    return this.creation.createReference(name, topics, client, engagement);
  }

  validateResult(result: CreateFileResult): void {
    return this.creation.validateResult(result);
  }

  // ─── Conversion delegation ───────────────────────────────────────────────

  convertInboxToProject(inboxFile: TFile, projectName?: string): Promise<TFile> {
    return this.conversion.convertInboxToProject(inboxFile, projectName);
  }

  convertSingleToRecurring(singleFile: TFile, recurringName?: string): Promise<TFile> {
    return this.conversion.convertSingleToRecurring(singleFile, recurringName);
  }
}
