import type { App, TFile } from "obsidian";
import type { ContextFilterField } from "../constants";
import type {
  DataviewApi,
  DataviewPage,
  DataviewTask,
  DashboardFilters,
  DueDateFilter,
  StartDateFilter,
  ScheduledDateFilter,
  MeetingDateFilter,
  InboxStatusFilter,
  ParsedTask,
  EntityType,
  SortKey,
  SearchScope,
  SearchResult,
} from "../types";

/**
 * Service interfaces for Dependency Inversion.
 *
 * All consumers (commands, processors) depend on these interfaces rather
 * than on the concrete service classes. This decouples the layers and
 * makes mocking in tests trivial.
 */

export interface IEntityQueryService {
  /** Returns the live Dataview API, or null if Dataview is not available. */
  dv(): DataviewApi | null;
  getEntitiesByTag(tag: string, folder?: string): DataviewPage[];
  getEntitiesByFolder(folder: string): DataviewPage[];
  getEntitiesByStatus(tag: string, status: string | string[]): DataviewPage[];
  getActiveEntitiesByTag(tag: string): DataviewPage[];
  getLinkedEntities(folder: string, tag: string, property: string, targetFile: TFile): DataviewPage[];
  getMentions(targetFile: TFile): DataviewPage[];
  getProjectNotes(projectFile: TFile): DataviewPage[];
  getPage(path: string): DataviewPage | null;
  getActiveRecurringMeetings(): DataviewPage[];
  getRecurringMeetingEvents(meetingName: string): DataviewPage[];
}

/**
 * Options controlling how a single entity note is materialized on disk.
 * All fields are optional; omitting one skips that step.
 */
export interface MaterializeEntityOptions {
  /** Extra template variables merged over the defaults and the entity name. */
  extraVars?: Record<string, string>;
  /** Transforms the rendered template content before the file is written (e.g. task injection). */
  contentTransform?: (content: string) => string;
  /** Mutates the file's frontmatter via processFrontMatter after creation. */
  frontmatter?: (fm: Record<string, unknown>) => void;
  /** When true, signals successful creation through the injected notification service. */
  notice?: boolean;
  /** When true, opens the newly created file via the navigation service. */
  open?: boolean;
}

/**
 * Narrow capability for turning an entity type + name + folder into a note on
 * disk, owning the folder/template/notification policy. Consumed by bulk
 * generators (e.g. test-data) that reuse the real creation pipeline.
 */
export interface IEntityMaterializer {
  materializeEntity(
    type: EntityType,
    name: string,
    folder: string,
    options?: MaterializeEntityOptions
  ): Promise<TFile>;
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
  createRaidItem(name: string, raidType: string, engagement?: string, owner?: string): Promise<TFile>;
  createReferenceTopic(name: string, parentName?: string): Promise<TFile>;
  /**
   * Assigns or clears the parent of an existing reference topic. Resolves the
   * topic note from the configured referenceTopics folder and writes (or, when
   * parentName is omitted, removes) the parent wikilink via processFrontMatter.
   */
  setReferenceTopicParent(topicName: string, parentName?: string): Promise<void>;
  createReference(name: string, topics: string[], client?: string, engagement?: string): Promise<TFile>;
}

export interface IEntityConversionService {
  convertInboxToProject(inboxFile: TFile, projectName?: string): Promise<TFile>;
  convertSingleToRecurring(singleFile: TFile, recurringName?: string): Promise<TFile>;
}

export interface INavigationService {
  openFile(file: TFile): Promise<void>;
}

/** Displays user-facing notifications, keeping UI construction out of the services layer. */
export interface INotificationService {
  notify(message: string): void;
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
    hierarchyService: IEntityHierarchyService
  ): DataviewTask[];
  applyContextSpecificFilters(
    tasks: DataviewTask[],
    f: Pick<DashboardFilters, ContextFilterField>,
    dv: DataviewApi
  ): DataviewTask[];
  matchesDueDateFilter(task: DataviewTask, filter: DueDateFilter): boolean;
  matchesStartDateFilter(task: DataviewTask, filter: StartDateFilter): boolean;
  matchesScheduledDateFilter(task: DataviewTask, filter: ScheduledDateFilter): boolean;
  matchesTagFilter(task: DataviewTask, tagFilter: string[], includeUntagged: boolean): boolean;
  matchesMeetingDateFilter(dateStr: string, filter: MeetingDateFilter): boolean;
  matchesClientFilter(
    task: DataviewTask,
    clientFilter: string[],
    includeUnassigned: boolean,
    dv: DataviewApi,
    hierarchyService: IEntityHierarchyService
  ): boolean;
  matchesEngagementFilter(
    task: DataviewTask,
    engagementFilter: string[],
    includeUnassigned: boolean,
    dv: DataviewApi,
    hierarchyService: IEntityHierarchyService
  ): boolean;
  matchesInboxStatusFilter(pageStatus: unknown, filter: InboxStatusFilter): boolean;
}

export interface ITaskSortService {
  sortTasks(tasks: DataviewTask[], keys: SortKey[], contextMap?: Map<string, string>, mtimeMap?: Map<string, number>): DataviewTask[];
  compareGroups(aTasks: DataviewTask[], bTasks: DataviewTask[], keys: SortKey[], contextMap?: Map<string, string>, mtimeMap?: Map<string, number>): number;
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

/**
 * Resolves entity hierarchy (client and engagement) from a DataviewPage.
 * Centralises the dual-path resolution logic so that all consumers —
 * RAID dashboard, task filter, reference views — share one implementation.
 */
export interface IEntityHierarchyService {
  /** Returns the resolved client name for a page, or null if none can be found. */
  resolveClientName(page: DataviewPage): string | null;
  /** Returns the resolved engagement name for a page, or null if none can be found. */
  resolveEngagementName(page: DataviewPage): string | null;
}

/**
 * Resolves the set of person names associated with an entity page (self for a
 * Person note, a RAID item's owner, a meeting's attendees, and the reports-to
 * chain). The narrow abstraction the person scope facet depends on.
 */
export interface IPersonAssociationResolver {
  /** Normalised, de-duplicated person names associated with the page. */
  peopleOf(page: DataviewPage): string[];
}

/**
 * Fuzzy name search over enumerated entities, constrained by an optional
 * hierarchy/person scope. Narrow by design (ISP): a consumer takes this
 * interface, never the full service bundle.
 */
export interface ISearchService {
  /**
   * Fuzzy-ranks the pages of the requested `types` by `query` (non-matches
   * dropped, best first), keeps those satisfying every populated `scope` leg,
   * and returns them as {@link SearchResult}s. An empty scope imposes no
   * hierarchy constraint; returns `[]` (never throws) when Dataview is absent.
   */
  search(query: string, scope: SearchScope, types: EntityType[]): SearchResult[];
}

/** Narrow service bundle consumed by RAID processors. */
export interface RaidProcessorServices {
  app: App;
  queryService: IEntityQueryService;
  hierarchyService: IEntityHierarchyService;
  loggerService: ILoggerService;
}
