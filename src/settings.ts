import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type ProjectManagerPlugin from "./main";
import { DEFAULT_FOLDERS, PLUGIN_ID } from "./constants";

export interface LoggingSettings {
  enabled: boolean;
  logDirectory: string;
  minLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
  maxRetentionDays: number;
}

export interface FolderSettings {
  clients: string;
  engagements: string;
  projects: string;
  projectNotes: string;
  people: string;
  inbox: string;
  meetingsSingle: string;
  meetingsRecurring: string;
  meetingsRecurringEvents: string;
  dailyNotes: string;
  utility: string;
  raid: string;
  references: string;
  referenceTopics: string;
}

export interface DefaultValueSettings {
  clientStatus: string;
  engagementStatus: string;
  projectStatus: string;
  defaultTaskViewStatuses: string[];
}

export interface UiPreferenceSettings {
  showRibbonIcons: boolean;
  defaultTaskViewMode: "context" | "date" | "priority" | "tag";
  showCompletedByDefault: boolean;
}

export interface ProjectManagerSettings {
  folders: FolderSettings;
  defaults: DefaultValueSettings;
  ui: UiPreferenceSettings;
  logging: LoggingSettings;
}

export const DEFAULT_SETTINGS: ProjectManagerSettings = {
  folders: {
    clients: DEFAULT_FOLDERS.clients,
    engagements: DEFAULT_FOLDERS.engagements,
    projects: DEFAULT_FOLDERS.projects,
    projectNotes: DEFAULT_FOLDERS.projectNotes,
    people: DEFAULT_FOLDERS.people,
    inbox: DEFAULT_FOLDERS.inbox,
    meetingsSingle: DEFAULT_FOLDERS.meetingsSingle,
    meetingsRecurring: DEFAULT_FOLDERS.meetingsRecurring,
    meetingsRecurringEvents: DEFAULT_FOLDERS.meetingsRecurringEvents,
    dailyNotes: DEFAULT_FOLDERS.dailyNotes,
    utility: DEFAULT_FOLDERS.utility,
    raid: DEFAULT_FOLDERS.raid,
    references: DEFAULT_FOLDERS.references,
    referenceTopics: DEFAULT_FOLDERS.referenceTopics,
  },
  defaults: {
    clientStatus: "Active",
    engagementStatus: "Active",
    projectStatus: "New",
    defaultTaskViewStatuses: ["New", "Active", "On Hold"],
  },
  ui: {
    showRibbonIcons: true,
    defaultTaskViewMode: "context",
    showCompletedByDefault: false,
  },
  logging: {
    enabled: false,
    logDirectory: "utility/logs",
    minLevel: "INFO",
    maxRetentionDays: 30,
  },
};

/**
 * Merge saved settings with defaults, performing a two-level deep merge so that
 * sub-objects (folders, defaults, ui, logging) are merged key-by-key rather than
 * replaced wholesale. Missing keys in `saved` fall back to `defaults`.
 */
export function mergeSettings(
  defaults: ProjectManagerSettings,
  saved: Partial<ProjectManagerSettings>
): ProjectManagerSettings {
  return {
    ...defaults,
    ...saved,
    folders:  { ...defaults.folders,  ...(saved.folders  ?? {}) },
    defaults: { ...defaults.defaults, ...(saved.defaults ?? {}) },
    ui:       { ...defaults.ui,       ...(saved.ui       ?? {}) },
    logging:  { ...defaults.logging,  ...(saved.logging  ?? {}) },
  };
}

/**
 * Settings tab UI. Registered in main.ts via addSettingTab().
 * Folder paths, default values, UI preferences, and vault management.
 */
export class ProjectManagerSettingTab extends PluginSettingTab {
  plugin: ProjectManagerPlugin;

  constructor(app: App, plugin: ProjectManagerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Project Manager Settings" });

    this.renderFolderSettings(containerEl);
    this.renderDefaultValueSettings(containerEl);
    this.renderUiPreferenceSettings(containerEl);
    this.renderLoggingSettings(containerEl);
    this.renderVaultManagementSettings(containerEl);
    this.renderDeveloperSettings(containerEl);
  }

  private renderFolderSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Folder Paths" });
    containerEl.createEl("p", {
      text: "Configure the vault folders used for each entity type.",
      cls: "setting-item-description",
    });

    const folderFields: Array<{ key: keyof FolderSettings; name: string; desc: string }> = [
      { key: "clients", name: "Clients folder", desc: "Folder for client notes" },
      { key: "engagements", name: "Engagements folder", desc: "Folder for engagement notes" },
      { key: "projects", name: "Projects folder", desc: "Folder for project notes" },
      {
        key: "projectNotes",
        name: "Project notes folder",
        desc: "Base folder for project sub-notes",
      },
      { key: "people", name: "People folder", desc: "Folder for person notes" },
      { key: "inbox", name: "Inbox folder", desc: "Folder for inbox items" },
      {
        key: "meetingsSingle",
        name: "Single meetings folder",
        desc: "Folder for single meeting notes",
      },
      {
        key: "meetingsRecurring",
        name: "Recurring meetings folder",
        desc: "Folder for recurring meeting notes",
      },
      {
        key: "meetingsRecurringEvents",
        name: "Recurring meeting events folder",
        desc: "Folder for recurring meeting event notes",
      },
      { key: "dailyNotes", name: "Daily notes folder", desc: "Folder for daily notes" },
      { key: "utility", name: "Utility folder", desc: "Folder containing utility files" },
      { key: "raid", name: "RAID folder", desc: "Folder for RAID item notes" },
      { key: "references", name: "References folder", desc: "Folder for reference notes" },
      { key: "referenceTopics", name: "Reference Topics folder", desc: "Folder for reference topic notes" },
    ];

    for (const field of folderFields) {
      new Setting(containerEl)
        .setName(field.name)
        .setDesc(field.desc)
        .addText((text) =>
          text
            .setPlaceholder(DEFAULT_FOLDERS[field.key])
            .setValue(this.plugin.settings.folders[field.key])
            .onChange(async (value) => {
              this.plugin.settings.folders[field.key] = value.trim() || DEFAULT_FOLDERS[field.key];
              await this.plugin.saveSettings();
            })
        );
    }
  }

  private renderDefaultValueSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Default Values" });

    new Setting(containerEl)
      .setName("Default project status")
      .setDesc("Status assigned to newly created projects")
      .addDropdown((dd) =>
        dd
          .addOptions({ New: "New", Active: "Active", "On Hold": "On Hold" })
          .setValue(this.plugin.settings.defaults.projectStatus)
          .onChange(async (value) => {
            this.plugin.settings.defaults.projectStatus = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderUiPreferenceSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "UI Preferences" });

    new Setting(containerEl)
      .setName("Show ribbon icons")
      .setDesc("Show Project Manager icons in the left ribbon")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.ui.showRibbonIcons).onChange(async (value) => {
          this.plugin.settings.ui.showRibbonIcons = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Default task view mode")
      .setDesc("Default grouping mode for the task dashboard")
      .addDropdown((dd) =>
        dd
          .addOptions({
            context: "Context",
            date: "Due Date",
            priority: "Priority",
            tag: "Tag",
          })
          .setValue(this.plugin.settings.ui.defaultTaskViewMode)
          .onChange(async (value) => {
            this.plugin.settings.ui.defaultTaskViewMode = value as
              | "context"
              | "date"
              | "priority"
              | "tag";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show completed tasks by default")
      .setDesc("Include completed tasks when the task dashboard first loads")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.ui.showCompletedByDefault)
          .onChange(async (value) => {
            this.plugin.settings.ui.showCompletedByDefault = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderLoggingSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Debug Logging" });
    containerEl.createEl("p", {
      text: "Write plugin activity to log files in your vault for debugging purposes.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Enable logging")
      .setDesc("Write debug log entries to vault files")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.logging.enabled).onChange(async (value) => {
          this.plugin.settings.logging.enabled = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Log directory")
      .setDesc("Vault-relative folder path for log files (e.g. utility/logs)")
      .addText((text) =>
        text
          .setPlaceholder("utility/logs")
          .setValue(this.plugin.settings.logging.logDirectory)
          .onChange(async (value) => {
            this.plugin.settings.logging.logDirectory = value.trim() || "utility/logs";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Minimum log level")
      .setDesc("Only log entries at or above this level")
      .addDropdown((dd) =>
        dd
          .addOptions({ DEBUG: "DEBUG", INFO: "INFO", WARN: "WARN", ERROR: "ERROR" })
          .setValue(this.plugin.settings.logging.minLevel)
          .onChange(async (value) => {
            this.plugin.settings.logging.minLevel = value as LoggingSettings["minLevel"];
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Log retention days")
      .setDesc("Delete log files older than this many days (0 = keep all)")
      .addText((text) =>
        text
          .setPlaceholder("30")
          .setValue(String(this.plugin.settings.logging.maxRetentionDays))
          .onChange(async (value) => {
            const days = parseInt(value, 10);
            this.plugin.settings.logging.maxRetentionDays = isNaN(days) ? 30 : Math.max(0, days);
            await this.plugin.saveSettings();
          })
      );
  }

  private renderVaultManagementSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Vault Management" });

    new Setting(containerEl)
      .setName("Set up vault structure")
      .setDesc(
        "Create all required folders and default view files. Safe to run on an existing vault."
      )
      .addButton((btn) =>
        btn
          .setButtonText("Set Up Vault")
          .setCta()
          .onClick(() => {
            this.plugin.commandExecutor.executeCommandById(`${PLUGIN_ID}:scaffold-vault`);
          })
      );
  }

  private renderDeveloperSettings(containerEl: HTMLElement): void {
    containerEl.createEl("h3", { text: "Developer Tools" });
    containerEl.createEl("p", {
      text: "Tools for development and testing. Use with caution in production vaults.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Generate test data")
      .setDesc(
        "Create 90 sample entities (10 per type) with 5 tasks each, all prefixed with TEST -."
      )
      .addButton((btn) => {
        btn.setButtonText("Generate Test Data").setCta();
        btn.onClick(async () => {
          btn.setDisabled(true);
          btn.setButtonText("Generating...");
          try {
            const result = await this.plugin.testDataService.generateTestData();
            const msg =
              result.errors.length === 0
                ? `Generated ${result.totalFiles} files with ${result.totalTasks} tasks.`
                : `Generated ${result.totalFiles} files with ${result.totalTasks} tasks. ${result.errors.length} error(s) — check console.`;
            new Notice(msg);
          } catch (err) {
            new Notice(`Test data generation failed: ${String(err)}`);
          } finally {
            btn.setDisabled(false);
            btn.setButtonText("Generate Test Data");
          }
        });
      });

    new Setting(containerEl)
      .setName("Clean test data")
      .setDesc("Delete all files whose name begins with TEST -.")
      .addButton((btn) => {
        btn.setButtonText("Clean Test Data");
        btn.onClick(async () => {
          btn.setDisabled(true);
          btn.setButtonText("Cleaning...");
          try {
            const count = await this.plugin.testDataService.cleanTestData();
            new Notice(`Deleted ${count} test file${count === 1 ? "" : "s"}.`);
          } catch (err) {
            new Notice(`Clean test data failed: ${String(err)}`);
          } finally {
            btn.setDisabled(false);
            btn.setButtonText("Clean Test Data");
          }
        });
      });
  }
}
