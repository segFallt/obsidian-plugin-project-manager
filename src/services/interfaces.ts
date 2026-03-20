import type { TFile } from "obsidian";
import type {
  DataviewApi,
  DataviewPage,
  DataviewTask,
  DashboardFilters,
  DueDateFilter,
  MeetingDateFilter,
  InboxStatusFilter,
  ParsedTask,
  EntityType,
  CreateFileResult,
  SortBy,
} from "../types";

/**
 * Service interfaces for Dependency Inversion.
 *
 * All consumers (commands, processors) depend on these interfaces rather
 * than on the concrete service classes. This decouples the layers and
 * makes mocking in tests trivial.
 */

export interface IQueryService {
  /** Returns the live Dataview API, or null if Dataview is not available. */
  dv(): DataviewApi | null;
  getEntitiesByTag(tag: string, folder?: string): DataviewPage[];
  getEntitiesByStatus(tag: string, status: string | string[]): DataviewPage[];
  getActiveEntitiesByTag(tag: string): DataviewPage[];
  getLinkedEntities(folder: string, tag: string, property: string, targetFile: TFile): DataviewPage[];
  getMentions(targetFile: TFile): DataviewPage[];
  getProjectNotes(projectFile: TFile): DataviewPage[];
  getEngagementForEntity(file: TFile): DataviewPage | null;
  getClientForEntity(file: TFile): DataviewPage | null;
  getParentProject(file: TFile): DataviewPage | null;
  getEngagementNameForPath(path: string): string | null;
  getClientFromEngagementLink(engagementLink: unknown): string | null;
  getPage(path: string): DataviewPage | null;
  getActiveRecurringMeetings(): DataviewPage[];
  getRecurringMeetingEvents(meetingName: string): DataviewPage[];
}

export interface IEntityCreationService {
  createClient(name: string): Promise<TFile>;
  createEngagement(name: string, clientName?: string): Promise<TFile>;
  createProject(name: string, engagementName?: string): Promise<TFile>;
  createPerson(name: string, clientName?: string): Promise<TFile>;
  createInboxNote(name: string, engagementName?: string): Promise<TFile>;
  createSingleMeeting(name: string, engagementName?: string): Promise<TFile>;
  createRecurringMeeting(name: string, engagementName?: string): Promise<TFile>;
  createProjectNote(projectFile: TFile, noteName: string): Promise<TFile>;
  createRecurringMeetingEvent(meetingName: string, options?: { date?: string; attendees?: string[]; notesContent?: string; open?: boolean }): Promise<TFile>;
  validateResult(result: CreateFileResult): void;
}

export interface IEntityConversionService {
  convertInboxToProject(inboxFile: TFile, projectName?: string): Promise<TFile>;
  convertSingleToRecurring(singleFile: TFile, recurringName?: string): Promise<TFile>;
}

export interface INavigationService {
  openFile(file: TFile): Promise<void>;
}

export interface ICommandExecutor {
  executeCommandById(commandId: string): void;
}

export interface IActionContextManager {
  get(): { field: string; value: string } | null;
  set(context: { field: string; value: string }): void;
  consume(): { field: string; value: string } | null;
}

/** Facade interface combining creation and conversion. Kept for backward compatibility. */
export interface IEntityService extends IEntityCreationService, IEntityConversionService {}

export interface ITemplateService {
  getTemplate(type: EntityType): string;
  processTemplate(template: string, vars: Record<string, string>): string;
  defaultVars(): Record<string, string>;
}

export interface ITaskParser {
  parseTaskLine(line: string, filePath: string, lineNumber: number): ParsedTask | null;
  parseTasksFromContent(content: string, filePath: string): ParsedTask[];
  toggleTaskLine(originalLine: string, nowCompleted: boolean): string;
}

export interface IScaffoldService {
  scaffoldVault(): Promise<void>;
}

export interface ITaskFilterService {
  applyDashboardFilters(
    tasks: DataviewTask[],
    f: DashboardFilters,
    dv: DataviewApi,
    queryService: IQueryService
  ): DataviewTask[];
  applyContextSpecificFilters(
    tasks: DataviewTask[],
    f: Pick<DashboardFilters, "projectStatusFilter" | "inboxStatusFilter" | "meetingDateFilter">,
    dv: DataviewApi
  ): DataviewTask[];
  matchesDueDateFilter(task: DataviewTask, filter: DueDateFilter): boolean;
  matchesTagFilter(task: DataviewTask, tagFilter: string[], includeUntagged: boolean): boolean;
  matchesMeetingDateFilter(dateStr: string, filter: MeetingDateFilter): boolean;
  matchesClientFilter(
    task: DataviewTask,
    clientFilter: string[],
    includeUnassigned: boolean,
    dv: DataviewApi,
    queryService: IQueryService
  ): boolean;
  matchesEngagementFilter(
    task: DataviewTask,
    engagementFilter: string[],
    includeUnassigned: boolean,
    queryService: IQueryService
  ): boolean;
  matchesInboxStatusFilter(pageStatus: unknown, filter: InboxStatusFilter): boolean;
}

export interface ITaskSortService {
  sortTasks(tasks: DataviewTask[], sortBy: SortBy): DataviewTask[];
  compareGroups(aTasks: DataviewTask[], bTasks: DataviewTask[], sortBy: SortBy): number;
}

export interface ILoggerService {
  debug(message: string, context?: string): void;
  info(message: string, context?: string): void;
  warn(message: string, context?: string): void;
  error(message: string, context?: string, err?: unknown): void;
  flush(): Promise<void>;
  cleanOldLogs(): Promise<void>;
}

/** Summary returned by TestDataService.generateTestData(). */
export interface TestDataResult {
  totalFiles: number;
  totalTasks: number;
  errors: string[];
}

export interface ITestDataService {
  /** Generate test entities across all entity types. */
  generateTestData(): Promise<TestDataResult>;
  /** Delete all files whose basename starts with [TEST]. Returns count deleted. */
  cleanTestData(): Promise<number>;
}
