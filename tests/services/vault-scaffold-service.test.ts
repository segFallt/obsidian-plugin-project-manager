import { describe, it, expect } from "vitest";
import { VaultScaffoldService } from "../../src/services/vault-scaffold-service";
import { createMockApp } from "../mocks/app-mock";
import { DEFAULT_SETTINGS } from "../../src/settings";

function createService(existingPaths: string[] = []) {
  const app = createMockApp();
  const createdFolders: string[] = [];
  const createdFiles: string[] = [];

  app.vault.adapter.exists = async (path) => existingPaths.includes(path);
  app.vault.createFolder = async (path) => { createdFolders.push(path); };
  app.vault.create = async (path, content) => {
    createdFiles.push(path);
    const { TFile } = await import("../mocks/obsidian-mock");
    return new TFile(path) as unknown as import("obsidian").TFile;
  };

  const svc = new VaultScaffoldService(
    app as unknown as import("obsidian").App,
    DEFAULT_SETTINGS
  );

  return { svc, app, createdFolders, createdFiles };
}

describe("VaultScaffoldService", () => {
  describe("scaffoldVault()", () => {
    it("creates all required folders", async () => {
      const { svc, createdFolders } = createService();
      await svc.scaffoldVault();

      expect(createdFolders).toContain("clients");
      expect(createdFolders).toContain("engagements");
      expect(createdFolders).toContain("projects");
      expect(createdFolders).toContain("projects/notes");
      expect(createdFolders).toContain("people");
      expect(createdFolders).toContain("inbox");
      expect(createdFolders).toContain("meetings/single");
      expect(createdFolders).toContain("meetings/recurring");
      expect(createdFolders).toContain("daily notes");
      expect(createdFolders).toContain("utility");
      expect(createdFolders).toContain("views");
    });

    it("creates all 15 default files (2 task views + 7 .base + 7 entity views)", async () => {
      const { svc, createdFiles } = createService();
      await svc.scaffoldVault();

      // Task views
      expect(createdFiles).toContain("views/Task Dashboard.md");
      expect(createdFiles).toContain("views/Tasks By Project.md");

      // .base files
      expect(createdFiles).toContain("views/Clients Base.base");
      expect(createdFiles).toContain("views/Engagements Base.base");
      expect(createdFiles).toContain("views/Projects Base.base");
      expect(createdFiles).toContain("views/People Base.base");
      expect(createdFiles).toContain("views/Inbox Base.base");
      expect(createdFiles).toContain("views/Single Meetings Base.base");
      expect(createdFiles).toContain("views/Recurring Meetings Base.base");

      // Entity view .md files
      expect(createdFiles).toContain("views/Clients.md");
      expect(createdFiles).toContain("views/Engagements.md");
      expect(createdFiles).toContain("views/Projects.md");
      expect(createdFiles).toContain("views/People.md");
      expect(createdFiles).toContain("views/Inbox.md");
      expect(createdFiles).toContain("views/Single Meeting.md");
      expect(createdFiles).toContain("views/Recurring Meeting.md");
    });

    it("skips existing files (idempotent)", async () => {
      const existingPath = "views/Task Dashboard.md";
      const { svc, createdFiles } = createService([existingPath]);
      await svc.scaffoldVault();

      expect(createdFiles).not.toContain(existingPath);
      expect(createdFiles).toContain("views/Tasks By Project.md");
    });

    it("task view files contain pm-tasks code blocks", async () => {
      const { svc, app } = createService();
      const fileContents: Record<string, string> = {};
      app.vault.create = async (path, content) => {
        fileContents[path] = content;
        const { TFile } = await import("../mocks/obsidian-mock");
        return new TFile(path) as unknown as import("obsidian").TFile;
      };

      await svc.scaffoldVault();

      expect(fileContents["views/Task Dashboard.md"]).toContain("pm-tasks");
      expect(fileContents["views/Task Dashboard.md"]).toContain("mode: dashboard");
      expect(fileContents["views/Tasks By Project.md"]).toContain("mode: by-project");
    });

    it(".base files contain folder paths from settings", async () => {
      const { svc, app } = createService();
      const fileContents: Record<string, string> = {};
      app.vault.create = async (path, content) => {
        fileContents[path] = content;
        const { TFile } = await import("../mocks/obsidian-mock");
        return new TFile(path) as unknown as import("obsidian").TFile;
      };

      await svc.scaffoldVault();

      expect(fileContents["views/Clients Base.base"]).toContain('file.inFolder("clients")');
      expect(fileContents["views/Clients Base.base"]).toContain("clients_active");
      expect(fileContents["views/Clients Base.base"]).toContain("clients_inactive");

      expect(fileContents["views/Engagements Base.base"]).toContain('file.inFolder("engagements")');
      expect(fileContents["views/Engagements Base.base"]).toContain("engagements_active");
      expect(fileContents["views/Engagements Base.base"]).toContain("engagements_inactive");

      expect(fileContents["views/Projects Base.base"]).toContain('file.inFolder("projects")');
      expect(fileContents["views/Projects Base.base"]).toContain("projects_active");
      expect(fileContents["views/Projects Base.base"]).toContain("projects_new");
      expect(fileContents["views/Projects Base.base"]).toContain("projects_onhold");
      expect(fileContents["views/Projects Base.base"]).toContain("projects_complete");

      expect(fileContents["views/People Base.base"]).toContain('file.inFolder("people")');
      expect(fileContents["views/People Base.base"]).toContain("people_active");
      expect(fileContents["views/People Base.base"]).toContain("people_all");

      expect(fileContents["views/Inbox Base.base"]).toContain('file.inFolder("inbox")');
      expect(fileContents["views/Inbox Base.base"]).toContain("inbox_active");
      expect(fileContents["views/Inbox Base.base"]).toContain("inbox_inactive");

      expect(fileContents["views/Single Meetings Base.base"]).toContain(
        'file.inFolder("meetings/single")'
      );
      expect(fileContents["views/Single Meetings Base.base"]).toContain("name: meetings");

      expect(fileContents["views/Recurring Meetings Base.base"]).toContain(
        'file.inFolder("meetings/recurring")'
      );
      expect(fileContents["views/Recurring Meetings Base.base"]).toContain("meetings_active");
      expect(fileContents["views/Recurring Meetings Base.base"]).toContain("meetings_past");
    });

    it("entity view .md files use pm-actions and .base embeds", async () => {
      const { svc, app } = createService();
      const fileContents: Record<string, string> = {};
      app.vault.create = async (path, content) => {
        fileContents[path] = content;
        const { TFile } = await import("../mocks/obsidian-mock");
        return new TFile(path) as unknown as import("obsidian").TFile;
      };

      await svc.scaffoldVault();

      expect(fileContents["views/Clients.md"]).toContain("pm-actions");
      expect(fileContents["views/Clients.md"]).toContain("create-client");
      expect(fileContents["views/Clients.md"]).toContain("Clients Base.base#clients_active");
      expect(fileContents["views/Clients.md"]).toContain("Clients Base.base#clients_inactive");

      expect(fileContents["views/Engagements.md"]).toContain("create-engagement");
      expect(fileContents["views/Engagements.md"]).toContain(
        "Engagements Base.base#engagements_active"
      );

      expect(fileContents["views/Projects.md"]).toContain("create-project");
      expect(fileContents["views/Projects.md"]).toContain("Projects Base.base#projects_active");
      expect(fileContents["views/Projects.md"]).toContain("Projects Base.base#projects_new");
      expect(fileContents["views/Projects.md"]).toContain("Projects Base.base#projects_onhold");
      expect(fileContents["views/Projects.md"]).toContain("Projects Base.base#projects_complete");

      expect(fileContents["views/People.md"]).toContain("create-person");
      expect(fileContents["views/People.md"]).toContain("People Base.base#people_active");
      expect(fileContents["views/People.md"]).toContain("People Base.base#people_all");

      expect(fileContents["views/Inbox.md"]).toContain("create-inbox");
      expect(fileContents["views/Inbox.md"]).toContain("Inbox Base.base#inbox_active");
      expect(fileContents["views/Inbox.md"]).toContain("Inbox Base.base#inbox_inactive");

      expect(fileContents["views/Single Meeting.md"]).toContain("create-single-meeting");
      expect(fileContents["views/Single Meeting.md"]).toContain(
        "Single Meetings Base.base#meetings"
      );

      expect(fileContents["views/Recurring Meeting.md"]).toContain("create-recurring-meeting");
      expect(fileContents["views/Recurring Meeting.md"]).toContain(
        "Recurring Meetings Base.base#meetings_active"
      );
      expect(fileContents["views/Recurring Meeting.md"]).toContain(
        "Recurring Meetings Base.base#meetings_past"
      );
    });

    it("uses custom folder paths from settings in .base files", async () => {
      const app = createMockApp();
      const fileContents: Record<string, string> = {};
      app.vault.adapter.exists = async () => false;
      app.vault.createFolder = async () => {};
      app.vault.create = async (path, content) => {
        fileContents[path] = content;
        const { TFile } = await import("../mocks/obsidian-mock");
        return new TFile(path) as unknown as import("obsidian").TFile;
      };

      const customSettings = {
        ...DEFAULT_SETTINGS,
        folders: {
          ...DEFAULT_SETTINGS.folders,
          clients: "custom/clients",
          meetingsSingle: "custom/meetings/single",
          meetingsRecurring: "custom/meetings/recurring",
        },
      };

      const svc = new VaultScaffoldService(
        app as unknown as import("obsidian").App,
        customSettings
      );
      await svc.scaffoldVault();

      expect(fileContents["views/Clients Base.base"]).toContain(
        'file.inFolder("custom/clients")'
      );
      expect(fileContents["views/Single Meetings Base.base"]).toContain(
        'file.inFolder("custom/meetings/single")'
      );
      expect(fileContents["views/Recurring Meetings Base.base"]).toContain(
        'file.inFolder("custom/meetings/recurring")'
      );
    });
  });
});
