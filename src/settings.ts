import { App, PluginSettingTab, Setting } from "obsidian";
import type ProjectManagerPlugin from "./main";
import { DEFAULT_FOLDERS, PLUGIN_ID } from "./constants";

export interface FolderSettings {
  clients: string;
  engagements: string;
  projects: string;
  projectNotes: string;
  people: string;
  inbox: string;
  meetingsSingle: string;
  meetingsRecurring: string;
  dailyNotes: string;
  utility: string;
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
    dailyNotes: DEFAULT_FOLDERS.dailyNotes,
    utility: DEFAULT_FOLDERS.utility,
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
};

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
    this.renderVaultManagementSettings(containerEl);
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
      { key: "dailyNotes", name: "Daily notes folder", desc: "Folder for daily notes" },
      { key: "utility", name: "Utility folder", desc: "Folder containing utility files" },
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
            type CommandHost = { commands?: { executeCommandById: (id: string) => void } };
            (this.plugin.app as unknown as CommandHost).commands?.executeCommandById(
              `${PLUGIN_ID}:scaffold-vault`
            );
          })
      );
  }
}
