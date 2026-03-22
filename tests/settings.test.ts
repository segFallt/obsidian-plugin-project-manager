import { describe, it, expect, vi } from "vitest";
import { DEFAULT_SETTINGS, ProjectManagerSettingTab, mergeSettings } from "@/settings";
import { App } from "./mocks/obsidian-mock";

describe("DEFAULT_SETTINGS", () => {
  it("has all required folder keys", () => {
    expect(DEFAULT_SETTINGS.folders).toHaveProperty("clients");
    expect(DEFAULT_SETTINGS.folders).toHaveProperty("engagements");
    expect(DEFAULT_SETTINGS.folders).toHaveProperty("projects");
    expect(DEFAULT_SETTINGS.folders).toHaveProperty("projectNotes");
    expect(DEFAULT_SETTINGS.folders).toHaveProperty("people");
    expect(DEFAULT_SETTINGS.folders).toHaveProperty("inbox");
    expect(DEFAULT_SETTINGS.folders).toHaveProperty("meetingsSingle");
    expect(DEFAULT_SETTINGS.folders).toHaveProperty("meetingsRecurring");
    expect(DEFAULT_SETTINGS.folders).toHaveProperty("dailyNotes");
    expect(DEFAULT_SETTINGS.folders).toHaveProperty("utility");
  });

  it("has all required defaults keys", () => {
    expect(DEFAULT_SETTINGS.defaults).toHaveProperty("clientStatus");
    expect(DEFAULT_SETTINGS.defaults).toHaveProperty("engagementStatus");
    expect(DEFAULT_SETTINGS.defaults).toHaveProperty("projectStatus");
    expect(DEFAULT_SETTINGS.defaults).toHaveProperty("defaultTaskViewStatuses");
  });

  it("has all required UI preference keys", () => {
    expect(DEFAULT_SETTINGS.ui).toHaveProperty("showRibbonIcons");
    expect(DEFAULT_SETTINGS.ui).toHaveProperty("defaultTaskViewMode");
    expect(DEFAULT_SETTINGS.ui).toHaveProperty("showCompletedByDefault");
  });

  it("uses expected default folder values", () => {
    expect(DEFAULT_SETTINGS.folders.clients).toBe("clients");
    expect(DEFAULT_SETTINGS.folders.engagements).toBe("engagements");
    expect(DEFAULT_SETTINGS.folders.projects).toBe("projects");
    expect(DEFAULT_SETTINGS.folders.inbox).toBe("inbox");
    expect(DEFAULT_SETTINGS.folders.meetingsSingle).toBe("meetings/single");
    expect(DEFAULT_SETTINGS.folders.meetingsRecurring).toBe("meetings/recurring");
  });

  it("has sane default task view statuses (excludes Complete)", () => {
    expect(DEFAULT_SETTINGS.defaults.defaultTaskViewStatuses).toContain("New");
    expect(DEFAULT_SETTINGS.defaults.defaultTaskViewStatuses).toContain("Active");
    expect(DEFAULT_SETTINGS.defaults.defaultTaskViewStatuses).not.toContain("Complete");
  });

  it("DEFAULT_SETTINGS.folders contains all 14 FolderSettings keys with non-empty string values", () => {
    const expectedKeys = [
      "clients",
      "engagements",
      "projects",
      "projectNotes",
      "people",
      "inbox",
      "meetingsSingle",
      "meetingsRecurring",
      "meetingsRecurringEvents",
      "dailyNotes",
      "utility",
      "raid",
      "references",
      "referenceTopics",
    ] as const;

    for (const key of expectedKeys) {
      expect(DEFAULT_SETTINGS.folders).toHaveProperty(key);
      expect(typeof DEFAULT_SETTINGS.folders[key]).toBe("string");
      expect(DEFAULT_SETTINGS.folders[key].length).toBeGreaterThan(0);
    }
  });

  it("deep merge preserves DEFAULT_SETTINGS.folders keys missing from a partial saved object", () => {
    // Simulate a data.json from an older installation that predates raid/references/referenceTopics
    const saved: Partial<typeof DEFAULT_SETTINGS> = {
      folders: {
        clients: "my-clients",
        engagements: "my-engagements",
        projects: "my-projects",
        projectNotes: "my-project-notes",
        people: "my-people",
        inbox: "my-inbox",
        meetingsSingle: "my-meetings/single",
        meetingsRecurring: "my-meetings/recurring",
        meetingsRecurringEvents: "my-meetings/recurring/events",
        dailyNotes: "my-daily",
        utility: "my-utility",
        // raid, references, referenceTopics intentionally omitted
      } as typeof DEFAULT_SETTINGS.folders,
    };

    const merged = mergeSettings(DEFAULT_SETTINGS, saved);

    // Keys present in saved should be preserved
    expect(merged.folders.clients).toBe("my-clients");

    // Keys absent from saved should fall back to DEFAULT_SETTINGS values
    expect(merged.folders.raid).toBe(DEFAULT_SETTINGS.folders.raid);
    expect(merged.folders.references).toBe(DEFAULT_SETTINGS.folders.references);
    expect(merged.folders.referenceTopics).toBe(DEFAULT_SETTINGS.folders.referenceTopics);
  });
});

describe("ProjectManagerSettingTab", () => {
  function createSettingTab() {
    const app = new App();
    const plugin = {
      app,
      settings: { ...DEFAULT_SETTINGS },
      saveSettings: vi.fn().mockResolvedValue(undefined),
    };
    const tab = new ProjectManagerSettingTab(
      app as unknown as import("obsidian").App,
      plugin as unknown as import("./src/main").default
    );
    return { tab, plugin };
  }

  it("display() populates containerEl with settings content", () => {
    const { tab } = createSettingTab();
    tab.display();
    // Should have rendered headings and settings
    expect(tab.containerEl.innerHTML).not.toBe("");
    expect(tab.containerEl.querySelector("h2")).not.toBeNull();
  });

  it("display() creates folder path settings", () => {
    const { tab } = createSettingTab();
    tab.display();
    // The rendered HTML should contain folder-related text
    const html = tab.containerEl.innerHTML;
    expect(html.length).toBeGreaterThan(100);
  });
});
