import { Notice, Plugin } from "obsidian";
import { ProjectManagerSettings, DEFAULT_SETTINGS, ProjectManagerSettingTab } from "./settings";
import { QueryService } from "./services/query-service";
import { EntityService } from "./services/entity-service";
import { EntityCreationService } from "./services/entity-creation-service";
import { EntityConversionService } from "./services/entity-conversion-service";
import { NavigationService } from "./services/navigation-service";
import { ActionContextManager } from "./services/action-context-manager";
import { CommandExecutor } from "./services/command-executor";
import { TemplateService } from "./services/template-service";
import { TaskParser } from "./services/task-parser";
import { TaskFilterService } from "./services/task-filter-service";
import { TaskSortService } from "./services/task-sort-service";
import { VaultScaffoldService } from "./services/vault-scaffold-service";
import { LoggerService } from "./services/logger-service";
import { TestDataService } from "./services/test-data-service";
import type {
  IQueryService,
  IEntityService,
  ITemplateService,
  ITaskParser,
  IScaffoldService,
  ILoggerService,
  IActionContextManager,
  ICommandExecutor,
  ITaskFilterService,
  ITaskSortService,
  ITestDataService,
} from "./services/interfaces";
import { registerAllCommands } from "./commands";
import { registerAllProcessors } from "./processors";
import { flushFilterStateCache } from "./processors/pm-tasks-processor";
import type { DataviewApi } from "./types";
import { DATAVIEW_PLUGIN_ID, NOTICE_DURATION_MS } from "./constants";

/**
 * Project Manager Plugin — main entry point.
 *
 * Initialises all services and registers commands + code block processors.
 * Requires the Dataview community plugin to be installed and enabled.
 */
export default class ProjectManagerPlugin extends Plugin {
  settings!: ProjectManagerSettings;

  // Services declared as interface types (DIP boundary).
  // Concrete classes are only referenced inside initServices().
  queryService!: IQueryService;
  entityService!: IEntityService;
  taskParser!: ITaskParser;
  scaffoldService!: IScaffoldService;
  loggerService!: ILoggerService;
  actionContext!: IActionContextManager;
  commandExecutor!: ICommandExecutor;
  filterService!: ITaskFilterService;
  sortService!: ITaskSortService;
  testDataService!: ITestDataService;

  // templateService is internal — used only by EntityCreationService, not exposed to consumers.
  private templateService!: ITemplateService;
  private loggerServiceImpl!: LoggerService;

  async onload() {
    await this.loadSettings();

    // Verify Dataview is available (warn, but don't block load)
    this.app.workspace.onLayoutReady(() => {
      this.initServices();
      this.loggerService.info("Plugin initialized", "main");
      registerAllCommands(this);
      registerAllProcessors(this);
    });

    this.addSettingTab(new ProjectManagerSettingTab(this.app, this));
  }

  onunload() {
    this.loggerService.info("Plugin unloading", "main");
    void flushFilterStateCache(this.app);
    void this.loggerService.flush();
    this.loggerServiceImpl.destroy();
  }

  /** Load settings from disk, merging with defaults for any missing keys. */
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<typeof DEFAULT_SETTINGS>);
  }

  /** Persist current settings to disk. */
  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Initialise all services.
   * Called after layout is ready so Dataview has time to load.
   */
  private initServices() {
    // LoggerService is initialized first so other services can use it.
    this.loggerServiceImpl = new LoggerService(this.app, () => this.settings.logging);
    this.loggerService = this.loggerServiceImpl;
    void this.loggerService.cleanOldLogs();

    const getDataviewApi = (): DataviewApi | null => {
      type PluginsHost = { plugins?: { plugins?: Record<string, { api?: DataviewApi }> } };
      const host = this.app as unknown as PluginsHost;
      const dv = host.plugins?.plugins?.[DATAVIEW_PLUGIN_ID]?.api;
      return dv ?? null;
    };

    const dvApi = getDataviewApi();
    if (!dvApi) {
      new Notice(
        "Project Manager: Dataview plugin not found. " +
          "Please install and enable the Dataview community plugin.",
        NOTICE_DURATION_MS
      );
    }

    this.templateService = new TemplateService();
    this.queryService = new QueryService(this.app, getDataviewApi, this.settings.folders);

    const navigationService = new NavigationService(this.app);
    const creationService = new EntityCreationService(this.app, this.settings, this.templateService, navigationService);
    const conversionService = new EntityConversionService(this.app, this.settings, creationService);
    this.entityService = new EntityService(creationService, conversionService);

    this.taskParser = new TaskParser();
    this.scaffoldService = new VaultScaffoldService(this.app, this.settings);
    this.actionContext = new ActionContextManager();
    this.commandExecutor = new CommandExecutor(this.app);
    this.filterService = new TaskFilterService(this.settings.folders);
    this.sortService = new TaskSortService();
    this.testDataService = new TestDataService(
      this.app,
      this.settings,
      this.templateService,
      this.loggerService
    );
  }
}
