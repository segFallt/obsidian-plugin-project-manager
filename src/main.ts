import { Notice, Plugin } from "obsidian";
import { ProjectManagerSettings, DEFAULT_SETTINGS, ProjectManagerSettingTab, mergeSettings } from "./settings";
import { ReferenceDashboardItemView } from "./views";
import { QueryService } from "./services/query-service";
import { EntityHierarchyService } from "./services/entity-hierarchy-service";
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
  IEntityHierarchyService,
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
import type { DataviewApi } from "./types";
import { DATAVIEW_PLUGIN_ID, TASKS_PLUGIN_ID, NOTICE_DURATION_MS } from "./constants";

/**
 * Project Manager Plugin — main entry point.
 *
 * Initialises all services and registers commands + code block processors.
 * Requires the Dataview community plugin to be installed and enabled.
 * Requires the Tasks community plugin for structured task authoring (emoji due dates, priorities, completion markers).
 */
export default class ProjectManagerPlugin extends Plugin {
  settings!: ProjectManagerSettings;

  // Services declared as interface types (DIP boundary).
  // Concrete classes are only referenced inside initServices().
  queryService!: IQueryService;
  hierarchyService!: IEntityHierarchyService;
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
      this.registerView(
        ReferenceDashboardItemView.VIEW_TYPE,
        (leaf) => new ReferenceDashboardItemView(leaf, this)
      );
      registerAllCommands(this);
      this.addCommand({
        id: "open-reference-dashboard",
        name: "PM: Open Reference Dashboard",
        callback: () => { void activateReferenceDashboard(this); },
      });
      if (this.settings.ui.showRibbonIcons) {
        this.addRibbonIcon("book-open", "Open Reference Dashboard", () => {
          void activateReferenceDashboard(this);
        });
      }
      registerAllProcessors(this);
    });

    this.addSettingTab(new ProjectManagerSettingTab(this.app, this));
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(ReferenceDashboardItemView.VIEW_TYPE);
    this.loggerService.info("Plugin unloading", "main");
    void this.loggerService.flush();
    this.loggerServiceImpl.destroy();
  }

  /** Load settings from disk, merging with defaults for any missing keys. */
  async loadSettings() {
    const saved = ((await this.loadData()) as Partial<ProjectManagerSettings> | null) ?? {};
    this.settings = mergeSettings(DEFAULT_SETTINGS, saved);
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

    type PluginsHost = { plugins?: { plugins?: Record<string, { api?: DataviewApi } | undefined> } };
    const host = this.app as unknown as PluginsHost;

    const getDataviewApi = (): DataviewApi | null => {
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

    if (!host.plugins?.plugins?.[TASKS_PLUGIN_ID]) {
      new Notice(
        "Project Manager: Tasks plugin not found. " +
          "Please install and enable the Tasks community plugin.",
        NOTICE_DURATION_MS
      );
    }

    this.templateService = new TemplateService();
    this.queryService = new QueryService(this.app, getDataviewApi, this.settings.folders);
    this.hierarchyService = new EntityHierarchyService(this.queryService);

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

// ─── Helper: activate Reference Dashboard panel ───────────────────────────────

/**
 * Opens the Reference Dashboard in the right sidebar. If the view is already
 * open in any leaf, reveals it instead of creating a duplicate.
 */
async function activateReferenceDashboard(plugin: ProjectManagerPlugin): Promise<void> {
  const existing = plugin.app.workspace.getLeavesOfType(ReferenceDashboardItemView.VIEW_TYPE);
  if (existing.length > 0) {
    void plugin.app.workspace.revealLeaf(existing[0]);
    return;
  }
  const leaf = plugin.app.workspace.getRightLeaf(false);
  if (!leaf) return;
  await leaf.setViewState({ type: ReferenceDashboardItemView.VIEW_TYPE, active: true });
  void plugin.app.workspace.revealLeaf(leaf);
}
