import { Notice, Plugin } from "obsidian";
import { ProjectManagerSettings, DEFAULT_SETTINGS, ProjectManagerSettingTab, mergeSettings } from "./settings";
import { ReferenceDashboardItemView, PmSearchItemView } from "./views";
import { QueryService } from "./services/query-service";
import { EntityHierarchyService } from "./services/entity-hierarchy-service";
import { EntityService } from "./services/entity-service";
import { EntityCreationService } from "./services/entity-creation-service";
import { EntityConversionService } from "./services/entity-conversion-service";
import { NavigationService } from "./services/navigation-service";
import { NotificationService } from "./services/notification-service";
import { ActionContextManager } from "./services/action-context-manager";
import { CommandExecutor } from "./services/command-executor";
import { COMMAND_IDS } from "./command-ids";
import { TemplateService } from "./services/template-service";
import { TaskParser } from "./services/task-parser";
import { TaskFilterService } from "./services/task-filter-service";
import { TaskSortService } from "./services/task-sort-service";
import { VaultScaffoldService } from "./services/vault-scaffold-service";
import { LoggerService } from "./services/logger-service";
import { TestDataService } from "./services/test-data-service";
import type {
  IEntityQueryService,
  IEntityService,
  IEntityHierarchyService,
  INavigationService,
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
import { registerBuiltInEntityQueries } from "./entity-registry";
import type { DataviewApi } from "./types";
import {
  DATAVIEW_PLUGIN_ID,
  TASKS_PLUGIN_ID,
  NOTICE_DURATION_MS,
  COMMAND_NAMES,
  LOG_CONTEXT,
  MAIN_MSG,
  REFERENCE_DASHBOARD_ICON,
  REFERENCE_DASHBOARD_RIBBON_TITLE,
  PM_SEARCH_ICON,
  PM_SEARCH_RIBBON_TITLE,
  WORKSPACE_LEAF_TYPE,
} from "./constants";

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
  queryService!: IEntityQueryService;
  hierarchyService!: IEntityHierarchyService;
  entityService!: IEntityService;
  navigationService!: INavigationService;
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

    // Register the Reference Dashboard view and construct its services
    // synchronously here, before the workspace restores its saved layout. A
    // restored leaf is a deferred view that resolves during layout restore,
    // earlier than onLayoutReady, so the view type must already be registered
    // and its services constructed by then for the leaf to resolve to a working
    // view. Services resolve the Dataview API lazily, so constructing them here
    // is safe.
    this.initServices();
    this.loggerService.info(MAIN_MSG.PLUGIN_INITIALIZED, LOG_CONTEXT.MAIN);
    this.registerView(
      ReferenceDashboardItemView.VIEW_TYPE,
      (leaf) => new ReferenceDashboardItemView(leaf, this)
    );
    this.registerView(
      PmSearchItemView.VIEW_TYPE,
      (leaf) => new PmSearchItemView(leaf, this)
    );

    // Deferred to layout-ready: dependency warnings need other community plugins
    // to have finished loading; commands, ribbon, processors, and entity queries
    // do not gate the dashboard view's ability to render.
    this.app.workspace.onLayoutReady(() => {
      this.warnMissingDependencies();
      registerAllCommands(this);
      this.addCommand({
        id: COMMAND_IDS.OPEN_REFERENCE_DASHBOARD,
        name: COMMAND_NAMES.OPEN_REFERENCE_DASHBOARD,
        callback: () => { void activateReferenceDashboard(this); },
      });
      this.addCommand({
        id: COMMAND_IDS.OPEN_SEARCH,
        name: COMMAND_NAMES.OPEN_SEARCH,
        callback: () => { void activateSearch(this); },
      });
      if (this.settings.ui.showRibbonIcons) {
        this.addRibbonIcon(REFERENCE_DASHBOARD_ICON, REFERENCE_DASHBOARD_RIBBON_TITLE, () => {
          void activateReferenceDashboard(this);
        });
        this.addRibbonIcon(PM_SEARCH_ICON, PM_SEARCH_RIBBON_TITLE, () => {
          void activateSearch(this);
        });
      }
      registerAllProcessors(this);
      registerBuiltInEntityQueries();
    });

    this.addSettingTab(new ProjectManagerSettingTab(this.app, this));
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(ReferenceDashboardItemView.VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(PmSearchItemView.VIEW_TYPE);
    this.loggerService.info(MAIN_MSG.PLUGIN_UNLOADING, LOG_CONTEXT.MAIN);
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
   * Construct all services. Invoked synchronously in onload() so the services
   * exist before the workspace restores deferred views (see onload). The
   * Dataview API is resolved lazily through the getDataviewApi closure, so it
   * need not be present at construction time; missing-dependency warnings are
   * deferred to warnMissingDependencies() once the layout is ready.
   */
  private initServices() {
    // LoggerService is initialized first so other services can use it.
    this.loggerServiceImpl = new LoggerService(this.app, () => this.settings.logging);
    this.loggerService = this.loggerServiceImpl;
    void this.loggerService.cleanOldLogs();

    const getDataviewApi = (): DataviewApi | null =>
      this.getCommunityPlugin(DATAVIEW_PLUGIN_ID)?.api ?? null;

    this.templateService = new TemplateService();
    this.queryService = new QueryService(getDataviewApi, this.settings.folders);
    this.hierarchyService = new EntityHierarchyService(getDataviewApi, this.settings.folders);

    this.navigationService = new NavigationService(this.app);
    const notificationService = new NotificationService();
    const creationService = new EntityCreationService(this.app, this.settings, this.templateService, this.navigationService, notificationService);
    const conversionService = new EntityConversionService(this.app, this.settings, creationService);
    this.entityService = new EntityService(creationService, conversionService);

    this.taskParser = new TaskParser();
    this.scaffoldService = new VaultScaffoldService(this.app, this.settings, notificationService);
    this.actionContext = new ActionContextManager();
    this.commandExecutor = new CommandExecutor(this.app, this.manifest.id);
    this.filterService = new TaskFilterService(this.settings.folders);
    this.sortService = new TaskSortService();
    this.testDataService = new TestDataService(
      this.app,
      this.settings,
      creationService,
      this.loggerService
    );
  }

  /**
   * Returns the registered community-plugin entry for `pluginId`, or undefined
   * when the plugin is not installed/enabled. The `api` field is populated by
   * plugins (e.g. Dataview) that expose one.
   */
  private getCommunityPlugin(pluginId: string): { api?: DataviewApi } | undefined {
    type PluginsHost = { plugins?: { plugins?: Record<string, { api?: DataviewApi } | undefined> } };
    return (this.app as unknown as PluginsHost).plugins?.plugins?.[pluginId];
  }

  /**
   * Warn (without blocking load) when a required community plugin is missing.
   * Deferred to onLayoutReady so other community plugins have finished loading
   * before their presence is checked, avoiding false "not installed" notices.
   */
  private warnMissingDependencies() {
    if (!this.getCommunityPlugin(DATAVIEW_PLUGIN_ID)?.api) {
      new Notice(MAIN_MSG.DATAVIEW_NOT_FOUND, NOTICE_DURATION_MS);
    }
    if (!this.getCommunityPlugin(TASKS_PLUGIN_ID)) {
      new Notice(MAIN_MSG.TASKS_NOT_FOUND, NOTICE_DURATION_MS);
    }
  }
}

// ─── Helper: activate Reference Dashboard panel ───────────────────────────────

/**
 * Opens the Reference Dashboard in the main editor pane as a new tab. If the
 * view is already open in any leaf, reveals it instead of creating a duplicate.
 */
async function activateReferenceDashboard(plugin: ProjectManagerPlugin): Promise<void> {
  const existing = plugin.app.workspace.getLeavesOfType(ReferenceDashboardItemView.VIEW_TYPE);
  if (existing.length > 0) {
    void plugin.app.workspace.revealLeaf(existing[0]);
    return;
  }
  const leaf = plugin.app.workspace.getLeaf(WORKSPACE_LEAF_TYPE.TAB);
  if (!leaf) return;
  await leaf.setViewState({ type: ReferenceDashboardItemView.VIEW_TYPE, active: true });
  void plugin.app.workspace.revealLeaf(leaf);
}

// ─── Helper: activate pm-search panel ─────────────────────────────────────────

/**
 * Opens the pm-search panel in the main editor pane as a new tab. If the view
 * is already open in any leaf, reveals it instead of creating a duplicate.
 */
async function activateSearch(plugin: ProjectManagerPlugin): Promise<void> {
  const existing = plugin.app.workspace.getLeavesOfType(PmSearchItemView.VIEW_TYPE);
  if (existing.length > 0) {
    void plugin.app.workspace.revealLeaf(existing[0]);
    return;
  }
  const leaf = plugin.app.workspace.getLeaf(WORKSPACE_LEAF_TYPE.TAB);
  if (!leaf) return;
  await leaf.setViewState({ type: PmSearchItemView.VIEW_TYPE, active: true });
  void plugin.app.workspace.revealLeaf(leaf);
}
