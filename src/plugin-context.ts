import type { App, Command, MarkdownPostProcessorContext } from "obsidian";
import type {
  IEntityQueryService,
  IEntityService,
  IEntityHierarchyService,
  INavigationService,
  IScaffoldService,
  ITaskParser,
  ILoggerService,
  IActionContextManager,
  ICommandExecutor,
  ITaskFilterService,
  ITaskSortService,
  ITestDataService,
  ISearchService,
} from "./services/interfaces";
import type { DataviewApi } from "./types";
import type { ProjectManagerSettings } from "./settings";
import type ProjectManagerPlugin from "./main";
import { SearchService } from "./services/search-service";
import { EntityEnumerator } from "./services/entity-enumerator";
import { PersonAssociationResolver } from "./services/person-association-resolver";
import { PreparedFuzzyMatcher } from "./services/prepared-fuzzy-matcher";

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
  queryService: IEntityQueryService;
  entityService: IEntityService;
  hierarchyService: IEntityHierarchyService;
  loggerService: ILoggerService;
  actionContext: IActionContextManager;
}

/** Narrow interface for task processor consumers. */
export interface TaskProcessorServices {
  app: App;
  settings: ProjectManagerSettings;
  queryService: IEntityQueryService;
  hierarchyService: IEntityHierarchyService;
  taskParser: ITaskParser;
  loggerService: ILoggerService;
  filterService: ITaskFilterService;
  sortService: ITaskSortService;
}

/** Narrow interface for property/table/entity-view processor consumers. */
export interface PropertyProcessorServices {
  app: App;
  settings: ProjectManagerSettings;
  queryService: IEntityQueryService;
  loggerService: ILoggerService;
}

/**
 * Narrow interface for the recurring-events processor.
 *
 * Extends the property services with `taskParser` so task checkboxes rendered
 * inside event-tile notes can be persisted back to the note. Kept separate from
 * PropertyProcessorServices so taskParser is not leaked to the other
 * property/table/entity-view processors that do not need it (ISP).
 */
export interface RecurringEventsProcessorServices extends PropertyProcessorServices {
  taskParser: ITaskParser;
}

/** Narrow interface for action processor consumers. */
export interface ActionProcessorServices {
  app: App;
  settings: ProjectManagerSettings;
  loggerService: ILoggerService;
  commandExecutor: ICommandExecutor;
  actionContext: IActionContextManager;
}

/** The action-service keys the entity-view processor forwards to its action buttons. */
export const ENTITY_VIEW_ACTION_KEYS = ["commandExecutor", "actionContext"] as const;

/**
 * Narrow interface for the entity-view processor: the property/table reads plus
 * the action-button collaborators (`commandExecutor`/`actionContext`) — nothing
 * more. The concrete plugin satisfies it structurally.
 */
export type EntityViewProcessorServices = PropertyProcessorServices &
  Pick<ActionProcessorServices, (typeof ENTITY_VIEW_ACTION_KEYS)[number]>;

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
  queryService: IEntityQueryService;
  entityService: IEntityService;
  taskParser: ITaskParser;
  scaffoldService: IScaffoldService;
  loggerService: ILoggerService;
  filterService: ITaskFilterService;
  sortService: ITaskSortService;
  actionContext: IActionContextManager;
  commandExecutor: ICommandExecutor;
  testDataService: ITestDataService;
  hierarchyService: IEntityHierarchyService;
  navigationService: INavigationService;
}

export interface ReferenceProcessorServices {
  app: App;
  settings: ProjectManagerSettings;
  queryService: IEntityQueryService;
  hierarchyService: IEntityHierarchyService;
  navigationService: INavigationService;
  loggerService: ILoggerService;
  commandExecutor: ICommandExecutor;
  actionContext: IActionContextManager;
  saveSettings: () => Promise<void>;
}

/**
 * Builds the ReferenceProcessorServices bag from a plugin instance.
 *
 * Co-located with the interface so the identical field-for-field literal is
 * defined once rather than hand-maintained in every consumer (the item view
 * and the processor registrar). The plugin is referenced type-only to keep
 * this module free of any runtime import cycle.
 */
export function buildReferenceProcessorServices(
  plugin: ProjectManagerPlugin
): ReferenceProcessorServices {
  return {
    app: plugin.app,
    settings: plugin.settings,
    queryService: plugin.queryService,
    hierarchyService: plugin.hierarchyService,
    navigationService: plugin.navigationService,
    loggerService: plugin.loggerService,
    commandExecutor: plugin.commandExecutor,
    actionContext: plugin.actionContext,
    saveSettings: plugin.saveSettings.bind(plugin),
  };
}

/**
 * Narrow service bag for the search panel's view component (ISP).
 *
 * The panel runs fuzzy search ({@link ISearchService}), resolves a selected
 * result's file and opens it (`app` + `navigationService`), probes Dataview
 * availability to distinguish the "no matches" and "Dataview off" states
 * (`getDv`), and reports open failures without swallowing them
 * (`loggerService`). It depends on abstractions, never on the concrete plugin.
 */
export interface SearchViewServices {
  app: App;
  searchService: ISearchService;
  navigationService: INavigationService;
  loggerService: ILoggerService;
  /** Live Dataview API, or null when Dataview is unavailable. */
  getDv: () => DataviewApi | null;
}

/**
 * Builds the {@link SearchViewServices} bag from a plugin instance, co-located
 * with the interface so the field-for-field literal lives in one place. The
 * search pipeline's collaborators are composed here from the plugin's real
 * services; the plugin is referenced type-only to keep this module free of a
 * runtime cycle.
 */
export function buildSearchViewServices(plugin: ProjectManagerPlugin): SearchViewServices {
  const getDv = (): DataviewApi | null => plugin.queryService.dv();
  const searchService = new SearchService({
    getDv,
    enumerator: new EntityEnumerator(plugin.queryService),
    hierarchyService: plugin.hierarchyService,
    personResolver: new PersonAssociationResolver(getDv, plugin.settings.folders),
    matcher: new PreparedFuzzyMatcher(),
  });
  return {
    app: plugin.app,
    searchService,
    navigationService: plugin.navigationService,
    loggerService: plugin.loggerService,
    getDv,
  };
}

/** Bound version of Plugin.addCommand, passed from the wiring layer. */
export type AddCommandFn = (cmd: Command) => void;

/** Bound version of Plugin.registerMarkdownCodeBlockProcessor, passed from the wiring layer. */
export type RegisterProcessorFn = (
  lang: string,
  handler: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void
) => void;
