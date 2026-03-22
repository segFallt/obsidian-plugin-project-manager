import type { App, Command, MarkdownPostProcessorContext } from "obsidian";
import type {
  IQueryService,
  IEntityService,
  IScaffoldService,
  ITaskParser,
  ILoggerService,
  IActionContextManager,
  ICommandExecutor,
  ITaskFilterService,
  ITaskSortService,
  ITestDataService,
} from "./services/interfaces";
import type { ProjectManagerSettings } from "./settings";

/**
 * Narrow service bag consumed by commands.
 *
 * Commands and processors depend on this interface rather than the concrete
 * ProjectManagerPlugin class (service-locator anti-pattern). This satisfies
 * ISP — each consumer only sees the services it actually needs — and DIP —
 * consumers depend on abstractions, not implementations.
 */
export interface CommandServices {
  app: App;
  settings: ProjectManagerSettings;
  queryService: IQueryService;
  entityService: IEntityService;
  loggerService: ILoggerService;
  actionContext: IActionContextManager;
}

/** Narrow interface for task processor consumers. */
export interface TaskProcessorServices {
  app: App;
  settings: ProjectManagerSettings;
  queryService: IQueryService;
  taskParser: ITaskParser;
  loggerService: ILoggerService;
  filterService: ITaskFilterService;
  sortService: ITaskSortService;
}

/** Narrow interface for property/table/entity-view processor consumers. */
export interface PropertyProcessorServices {
  app: App;
  settings: ProjectManagerSettings;
  queryService: IQueryService;
  loggerService: ILoggerService;
}

/** Narrow interface for action processor consumers. */
export interface ActionProcessorServices {
  app: App;
  settings: ProjectManagerSettings;
  loggerService: ILoggerService;
  commandExecutor: ICommandExecutor;
  actionContext: IActionContextManager;
}

/** Narrow interface for scaffold command consumers. */
export interface ScaffoldCommandServices {
  scaffoldService: IScaffoldService;
  loggerService: ILoggerService;
}

/**
 * Full service bag — superset of all narrow interfaces.
 * Used by the test mock helper and remains the structural type that
 * ProjectManagerPlugin satisfies at runtime.
 */
export interface PluginServices {
  app: App;
  settings: ProjectManagerSettings;
  queryService: IQueryService;
  entityService: IEntityService;
  taskParser: ITaskParser;
  scaffoldService: IScaffoldService;
  loggerService: ILoggerService;
  filterService: ITaskFilterService;
  sortService: ITaskSortService;
  actionContext: IActionContextManager;
  commandExecutor: ICommandExecutor;
  testDataService: ITestDataService;
}

export interface ReferenceProcessorServices {
  app: App;
  settings: ProjectManagerSettings;
  queryService: IQueryService;
  loggerService: ILoggerService;
}

/** Bound version of Plugin.addCommand, passed from the wiring layer. */
export type AddCommandFn = (cmd: Command) => void;

/** Bound version of Plugin.registerMarkdownCodeBlockProcessor, passed from the wiring layer. */
export type RegisterProcessorFn = (
  lang: string,
  handler: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void
) => void;
