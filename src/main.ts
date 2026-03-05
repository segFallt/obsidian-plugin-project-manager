import { Notice, Plugin } from "obsidian";
import { ProjectManagerSettings, DEFAULT_SETTINGS, ProjectManagerSettingTab } from "./settings";
import { QueryService } from "./services/query-service";
import { EntityService } from "./services/entity-service";
import { TemplateService } from "./services/template-service";
import { TaskParser } from "./services/task-parser";
import { VaultScaffoldService } from "./services/vault-scaffold-service";
import type {
  IQueryService,
  IEntityService,
  ITemplateService,
  ITaskParser,
  IScaffoldService,
} from "./services/interfaces";
import { registerAllCommands } from "./commands";
import { registerAllProcessors } from "./processors";
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

  // templateService is internal — used only by EntityService, not exposed to commands/processors.
  private templateService!: ITemplateService;

  /** Transient context set by action buttons; consumed and cleared by create commands. */
  pendingActionContext: { field: string; value: string } | null = null;

  async onload() {
    await this.loadSettings();

    // Verify Dataview is available (warn, but don't block load)
    this.app.workspace.onLayoutReady(() => {
      this.initServices();
      registerAllCommands(this);
      registerAllProcessors(this);
    });

    this.addSettingTab(new ProjectManagerSettingTab(this.app, this));
  }

  onunload() {
    // Obsidian cleans up registered commands and processors automatically
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
    this.entityService = new EntityService(this.app, this.settings, this.templateService);
    this.taskParser = new TaskParser();
    this.scaffoldService = new VaultScaffoldService(this.app, this.settings);
  }
}
