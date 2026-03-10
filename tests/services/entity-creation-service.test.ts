import { describe, it, expect, vi } from "vitest";
import { EntityCreationService } from "../../src/services/entity-creation-service";
import { TemplateService } from "../../src/services/template-service";
import { createMockApp, TFile } from "../mocks/app-mock";
import { DEFAULT_SETTINGS } from "../../src/settings";
import type { INavigationService } from "../../src/services/interfaces";

function createSvc(existingFiles: Parameters<typeof createMockApp>[0] = []) {
  const app = createMockApp(existingFiles);
  const templates = new TemplateService();
  const navigation: INavigationService = { openFile: vi.fn().mockResolvedValue(undefined) };
  const svc = new EntityCreationService(
    app as unknown as import("obsidian").App,
    DEFAULT_SETTINGS,
    templates,
    navigation
  );
  return { svc, app, navigation };
}

describe("EntityCreationService", () => {
  describe("createClient", () => {
    it("creates file at clients/<name>.md", async () => {
      const { svc, app } = createSvc();
      const paths: string[] = [];
      app.vault.create = async (p) => { paths.push(p); return new TFile(p); };
      await svc.createClient("Acme Corp");
      expect(paths[0]).toBe("clients/Acme Corp.md");
    });

    it("calls navigation.openFile after creation", async () => {
      const { svc, navigation } = createSvc();
      await svc.createClient("Acme Corp");
      expect(navigation.openFile).toHaveBeenCalledOnce();
    });

    it("resolves path conflicts by appending a counter", async () => {
      const { svc, app } = createSvc([{ path: "clients/Acme Corp.md", content: "" }]);
      const paths: string[] = [];
      app.vault.create = async (p) => { paths.push(p); return new TFile(p); };
      await svc.createClient("Acme Corp");
      expect(paths[0]).toBe("clients/Acme Corp 2.md");
    });
  });

  describe("createEngagement", () => {
    it("creates file at engagements/<name>.md", async () => {
      const { svc, app } = createSvc();
      const paths: string[] = [];
      app.vault.create = async (p) => { paths.push(p); return new TFile(p); };
      await svc.createEngagement("My Eng");
      expect(paths[0]).toBe("engagements/My Eng.md");
    });

    it("sets client frontmatter when clientName provided", async () => {
      const { svc, app } = createSvc();
      const mutations: Record<string, unknown> = {};
      app.fileManager.processFrontMatter = async (_f, fn) => { const fm = {}; fn(fm); Object.assign(mutations, fm); };
      await svc.createEngagement("My Eng", "Acme");
      expect(String(mutations.client ?? "")).toContain("Acme");
    });

    it("skips processFrontMatter when clientName omitted", async () => {
      const { svc, app } = createSvc();
      const spy = vi.spyOn(app.fileManager, "processFrontMatter");
      await svc.createEngagement("My Eng");
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("createProject", () => {
    it("creates file at projects/<name>.md", async () => {
      const { svc, app } = createSvc();
      const paths: string[] = [];
      app.vault.create = async (p) => { paths.push(p); return new TFile(p); };
      await svc.createProject("My Project");
      expect(paths[0]).toBe("projects/My Project.md");
    });

    it("embeds snake_case notesDirectory in template content", async () => {
      const { svc, app } = createSvc();
      let capturedContent = "";
      app.vault.create = async (p, c) => { capturedContent = c; return new TFile(p); };
      await svc.createProject("My New Project");
      expect(capturedContent).toContain("my_new_project");
    });

    it("sets engagement frontmatter when engagementName provided", async () => {
      const { svc, app } = createSvc();
      const mutations: Record<string, unknown> = {};
      app.fileManager.processFrontMatter = async (_f, fn) => { const fm = {}; fn(fm); Object.assign(mutations, fm); };
      await svc.createProject("P", "Eng Alpha");
      expect(String(mutations.engagement ?? "")).toContain("Eng Alpha");
    });
  });

  describe("createProjectNote", () => {
    it("creates note in notesDirectory", async () => {
      const projectFile = new TFile("projects/Foo.md");
      const { svc, app } = createSvc([{
        path: "projects/Foo.md",
        frontmatter: { notesDirectory: "projects/notes/foo" },
      }]);
      const paths: string[] = [];
      app.vault.create = async (p) => { paths.push(p); return new TFile(p); };
      await svc.createProjectNote(projectFile as unknown as import("obsidian").TFile, "Notes");
      expect(paths[0]).toBe("projects/notes/foo/Notes.md");
    });

    it("throws when project has no notesDirectory", async () => {
      const projectFile = new TFile("projects/Foo.md");
      const { svc } = createSvc([{ path: "projects/Foo.md", frontmatter: {} }]);
      await expect(
        svc.createProjectNote(projectFile as unknown as import("obsidian").TFile, "N")
      ).rejects.toThrow("notesDirectory");
    });
  });

  describe("createRecurringMeetingEvent", () => {
    it("creates event file in meetingsRecurringEvents/<meeting>/ folder", async () => {
      const { svc, app } = createSvc([{
        path: "meetings/recurring/Standup.md",
        frontmatter: { "default-attendees": [] },
      }]);
      const paths: string[] = [];
      app.vault.create = async (p) => { paths.push(p); return new TFile(p); };
      await svc.createRecurringMeetingEvent("Standup");
      expect(paths[0]).toMatch(/^meetings\/recurring-events\/Standup\//);
    });

    it("uses provided date (truncated to YYYY-MM-DD)", async () => {
      const { svc, app } = createSvc([{
        path: "meetings/recurring/Standup.md",
        frontmatter: { "default-attendees": [] },
      }]);
      const paths: string[] = [];
      app.vault.create = async (p) => { paths.push(p); return new TFile(p); };
      await svc.createRecurringMeetingEvent("Standup", { date: "2024-07-04T09:00" });
      expect(paths[0]).toContain("2024-07-04");
    });

    it("does not call navigation.openFile when open: false", async () => {
      const { svc, navigation } = createSvc([{
        path: "meetings/recurring/Standup.md",
        frontmatter: { "default-attendees": [] },
      }]);
      await svc.createRecurringMeetingEvent("Standup", { open: false });
      expect(navigation.openFile).not.toHaveBeenCalled();
    });
  });

  describe("validateResult", () => {
    it("does not throw when success is true", () => {
      const { svc } = createSvc();
      expect(() => svc.validateResult({ success: true })).not.toThrow();
    });

    it("throws with the provided error message when success is false", () => {
      const { svc } = createSvc();
      expect(() => svc.validateResult({ success: false, error: "oops" })).toThrow("oops");
    });

    it("throws a default message when error is not provided", () => {
      const { svc } = createSvc();
      expect(() => svc.validateResult({ success: false })).toThrow("Entity creation failed");
    });
  });
});
