import { describe, it, expect, vi } from "vitest";
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

      // Should create all 9 entity folders + the views folder
      expect(createdFolders).toContain("clients");
      expect(createdFolders).toContain("engagements");
      expect(createdFolders).toContain("projects");
      expect(createdFolders).toContain("projects/notes");
      expect(createdFolders).toContain("people");
      expect(createdFolders).toContain("inbox");
      expect(createdFolders).toContain("meetings");
      expect(createdFolders).toContain("daily notes");
      expect(createdFolders).toContain("utility");
      expect(createdFolders).toContain("views");
    });

    it("creates all 6 default view files", async () => {
      const { svc, createdFiles } = createService();
      await svc.scaffoldVault();

      expect(createdFiles).toContain("views/Task Dashboard.md");
      expect(createdFiles).toContain("views/Tasks By Project.md");
      expect(createdFiles).toContain("views/Clients.md");
      expect(createdFiles).toContain("views/Engagements.md");
      expect(createdFiles).toContain("views/Projects.md");
      expect(createdFiles).toContain("views/Inbox.md");
    });

    it("skips existing view files (idempotent)", async () => {
      const existingPath = "views/Task Dashboard.md";
      const { svc, createdFiles } = createService([existingPath]);
      await svc.scaffoldVault();

      // Should NOT create the file that already exists
      expect(createdFiles).not.toContain(existingPath);
      // But should still create the others
      expect(createdFiles).toContain("views/Tasks By Project.md");
    });

    it("view files contain the correct pm-tasks code block", async () => {
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
      expect(fileContents["views/Clients.md"]).toContain("dataview");
    });
  });
});
