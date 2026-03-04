import { describe, it, expect, vi } from "vitest";
import { EntityService } from "../../src/services/entity-service";
import { TemplateService } from "../../src/services/template-service";
import { createMockApp, TFile } from "../mocks/app-mock";
import { DEFAULT_SETTINGS } from "../../src/settings";

function createEntityService(existingFiles: Parameters<typeof createMockApp>[0] = []) {
  const app = createMockApp(existingFiles);
  const templates = new TemplateService();
  const svc = new EntityService(
    app as unknown as import("obsidian").App,
    DEFAULT_SETTINGS,
    templates
  );
  return { svc, app };
}

describe("EntityService", () => {
  describe("createClient", () => {
    it("creates a client file in the clients folder", async () => {
      const { svc, app } = createEntityService();
      const createdFiles: string[] = [];
      app.vault.create = async (path, content) => {
        createdFiles.push(path);
        return new TFile(path);
      };

      await svc.createClient("Acme Corp");
      expect(createdFiles).toHaveLength(1);
      expect(createdFiles[0]).toBe("clients/Acme Corp.md");
    });

    it("resolves path conflicts by appending a counter", async () => {
      const { svc, app } = createEntityService([
        { path: "clients/Acme Corp.md", content: "" },
      ]);

      const createdFiles: string[] = [];
      app.vault.create = async (path, content) => {
        createdFiles.push(path);
        return new TFile(path);
      };

      await svc.createClient("Acme Corp");
      expect(createdFiles[0]).toBe("clients/Acme Corp 2.md");
    });
  });

  describe("createEngagement", () => {
    it("creates an engagement file in the engagements folder", async () => {
      const { svc, app } = createEntityService();
      const createdFiles: string[] = [];
      app.vault.create = async (path) => {
        createdFiles.push(path);
        return new TFile(path);
      };
      await svc.createEngagement("My Engagement");
      expect(createdFiles[0]).toBe("engagements/My Engagement.md");
    });

    it("sets client frontmatter when clientName is provided", async () => {
      const { svc, app } = createEntityService();
      const mutations: Record<string, unknown> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        Object.assign(mutations, fm);
      };
      await svc.createEngagement("My Engagement", "Acme Corp");
      expect(String(mutations.client ?? "")).toContain("Acme Corp");
    });

    it("creates engagement without client when clientName is omitted", async () => {
      const { svc, app } = createEntityService();
      const spy = vi.spyOn(app.fileManager, "processFrontMatter");
      await svc.createEngagement("My Engagement");
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("createPerson", () => {
    it("creates a person file in the people folder", async () => {
      const { svc, app } = createEntityService();
      const createdFiles: string[] = [];
      app.vault.create = async (path) => {
        createdFiles.push(path);
        return new TFile(path);
      };
      await svc.createPerson("Alice Smith");
      expect(createdFiles[0]).toBe("people/Alice Smith.md");
    });

    it("sets client frontmatter when clientName is provided", async () => {
      const { svc, app } = createEntityService();
      const mutations: Record<string, unknown> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        Object.assign(mutations, fm);
      };
      await svc.createPerson("Alice Smith", "Acme Corp");
      expect(String(mutations.client ?? "")).toContain("Acme Corp");
    });

    it("creates person without client when clientName is omitted", async () => {
      const { svc, app } = createEntityService();
      const spy = vi.spyOn(app.fileManager, "processFrontMatter");
      await svc.createPerson("Alice Smith");
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("createInboxNote", () => {
    it("creates an inbox note in the inbox folder", async () => {
      const { svc, app } = createEntityService();
      const createdFiles: string[] = [];
      app.vault.create = async (path) => {
        createdFiles.push(path);
        return new TFile(path);
      };
      await svc.createInboxNote("TODO item");
      expect(createdFiles[0]).toBe("inbox/TODO item.md");
    });

    it("sets engagement frontmatter when engagementName is provided", async () => {
      const { svc, app } = createEntityService();
      const mutations: Record<string, unknown> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        Object.assign(mutations, fm);
      };
      await svc.createInboxNote("TODO", "My Engagement");
      expect(String(mutations.engagement ?? "")).toContain("My Engagement");
    });
  });

  describe("createSingleMeeting", () => {
    it("creates a meeting file in the meetings/single folder", async () => {
      const { svc, app } = createEntityService();
      const createdFiles: string[] = [];
      app.vault.create = async (path) => {
        createdFiles.push(path);
        return new TFile(path);
      };
      await svc.createSingleMeeting("Kickoff");
      expect(createdFiles[0]).toBe("meetings/single/Kickoff.md");
    });

    it("sets engagement frontmatter when engagementName is provided", async () => {
      const { svc, app } = createEntityService();
      const mutations: Record<string, unknown> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        Object.assign(mutations, fm);
      };
      await svc.createSingleMeeting("Kickoff", "Eng Alpha");
      expect(String(mutations.engagement ?? "")).toContain("Eng Alpha");
    });
  });

  describe("createRecurringMeeting", () => {
    it("creates a recurring meeting file in the meetings/recurring folder", async () => {
      const { svc, app } = createEntityService();
      const createdFiles: string[] = [];
      app.vault.create = async (path) => {
        createdFiles.push(path);
        return new TFile(path);
      };
      await svc.createRecurringMeeting("Weekly Standup");
      expect(createdFiles[0]).toBe("meetings/recurring/Weekly Standup.md");
    });

    it("sets engagement frontmatter when engagementName is provided", async () => {
      const { svc, app } = createEntityService();
      const mutations: Record<string, unknown> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        Object.assign(mutations, fm);
      };
      await svc.createRecurringMeeting("Weekly Standup", "Eng Beta");
      expect(String(mutations.engagement ?? "")).toContain("Eng Beta");
    });
  });

  describe("createProject", () => {
    it("creates a project file in the projects folder", async () => {
      const { svc, app } = createEntityService();
      const createdFiles: string[] = [];
      app.vault.create = async (path, content) => {
        createdFiles.push(path);
        return new TFile(path);
      };
      await svc.createProject("My Project");
      expect(createdFiles[0]).toBe("projects/My Project.md");
    });

    it("generates snake_case notesDirectory", async () => {
      const { svc, app } = createEntityService();

      let capturedContent = "";
      app.vault.create = async (path, content) => {
        capturedContent = content;
        return new TFile(path);
      };

      await svc.createProject("My New Project");
      // notesDirectory should appear in the template with snake_case
      expect(capturedContent).toContain("my_new_project");
    });

    it("sets engagement via processFrontMatter when engagementName is provided", async () => {
      const { svc, app } = createEntityService();
      const mutations: Record<string, unknown> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        Object.assign(mutations, fm);
      };
      await svc.createProject("My Project", "Acme Engagement");
      expect(String(mutations.engagement ?? "")).toContain("Acme Engagement");
    });

    it("does not call processFrontMatter when engagementName is omitted", async () => {
      const { svc, app } = createEntityService();
      const spy = vi.spyOn(app.fileManager, "processFrontMatter");
      await svc.createProject("My Project");
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("createProjectNote", () => {
    it("creates a project note in notesDirectory", async () => {
      const projectFile = new TFile("projects/Foo.md");
      const { svc, app } = createEntityService([
        {
          path: "projects/Foo.md",
          frontmatter: {
            notesDirectory: "projects/notes/foo",
            engagement: "[[My Engagement]]",
          },
        },
      ]);

      const createdFiles: string[] = [];
      app.vault.create = async (path, content) => {
        createdFiles.push(path);
        return new TFile(path);
      };

      await svc.createProjectNote(
        projectFile as unknown as import("obsidian").TFile,
        "Meeting Notes"
      );

      expect(createdFiles[0]).toBe("projects/notes/foo/Meeting Notes.md");
    });

    it("sets engagement via processFrontMatter when engagement is a wikilink string", async () => {
      const projectFile = new TFile("projects/Foo.md");
      const { svc, app } = createEntityService([
        {
          path: "projects/Foo.md",
          frontmatter: {
            notesDirectory: "projects/notes/foo",
            engagement: "[[My Engagement]]",
          },
        },
      ]);

      const mutations: Record<string, unknown> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        Object.assign(mutations, fm);
      };

      await svc.createProjectNote(
        projectFile as unknown as import("obsidian").TFile,
        "Note"
      );

      expect(String(mutations.engagement ?? "")).toContain("My Engagement");
    });

    it("sets engagement via processFrontMatter when engagement is a Link object", async () => {
      const projectFile = new TFile("projects/Foo.md");
      const { svc, app } = createEntityService([
        {
          path: "projects/Foo.md",
          frontmatter: {
            notesDirectory: "projects/notes/foo",
            engagement: { path: "engagements/My Engagement.md", type: "file" },
          },
        },
      ]);

      const mutations: Record<string, unknown> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        Object.assign(mutations, fm);
      };

      await svc.createProjectNote(
        projectFile as unknown as import("obsidian").TFile,
        "Note"
      );

      expect(String(mutations.engagement ?? "")).toContain("My Engagement");
    });

    it("throws if project has no notesDirectory", async () => {
      const projectFile = new TFile("projects/Foo.md");
      const { svc } = createEntityService([
        { path: "projects/Foo.md", frontmatter: {} },
      ]);

      await expect(
        svc.createProjectNote(
          projectFile as unknown as import("obsidian").TFile,
          "Note"
        )
      ).rejects.toThrow("notesDirectory");
    });
  });

  describe("openFile order — called after processFrontMatter", () => {
    it("createEngagement opens file after setting client frontmatter", async () => {
      const { svc, app } = createEntityService();
      const callOrder: string[] = [];

      app.fileManager.processFrontMatter = async (_file, fn) => {
        fn({});
        callOrder.push("processFrontMatter");
      };
      const leaf = { openFile: vi.fn(async () => { callOrder.push("openFile"); }) };
      app.workspace.getLeaf = () => leaf as unknown as ReturnType<typeof app.workspace.getLeaf>;

      await svc.createEngagement("My Engagement", "Acme Corp");
      expect(callOrder).toEqual(["processFrontMatter", "openFile"]);
    });

    it("createProject opens file after setting engagement frontmatter", async () => {
      const { svc, app } = createEntityService();
      const callOrder: string[] = [];

      app.fileManager.processFrontMatter = async (_file, fn) => {
        fn({});
        callOrder.push("processFrontMatter");
      };
      const leaf = { openFile: vi.fn(async () => { callOrder.push("openFile"); }) };
      app.workspace.getLeaf = () => leaf as unknown as ReturnType<typeof app.workspace.getLeaf>;

      await svc.createProject("My Project", "Acme Engagement");
      expect(callOrder).toEqual(["processFrontMatter", "openFile"]);
    });

    it("createSingleMeeting opens file after setting engagement frontmatter", async () => {
      const { svc, app } = createEntityService();
      const callOrder: string[] = [];

      app.fileManager.processFrontMatter = async (_file, fn) => {
        fn({});
        callOrder.push("processFrontMatter");
      };
      const leaf = { openFile: vi.fn(async () => { callOrder.push("openFile"); }) };
      app.workspace.getLeaf = () => leaf as unknown as ReturnType<typeof app.workspace.getLeaf>;

      await svc.createSingleMeeting("Kickoff", "Eng Alpha");
      expect(callOrder).toEqual(["processFrontMatter", "openFile"]);
    });
  });

  describe("convertInboxToProject", () => {
    it("creates a project and updates inbox frontmatter", async () => {
      const inboxFile = new TFile("inbox/Some Task.md");
      const { svc, app } = createEntityService([
        {
          path: "inbox/Some Task.md",
          frontmatter: { engagement: "[[My Engagement]]", status: "Active" },
        },
      ]);

      const mutations: Record<string, Record<string, unknown>> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        mutations[file.path] = { ...(mutations[file.path] ?? {}), ...fm };
      };

      await svc.convertInboxToProject(
        inboxFile as unknown as import("obsidian").TFile,
        "My Project"
      );

      // Inbox should be marked inactive with convertedTo link
      const inboxMutations = mutations["inbox/Some Task.md"];
      expect(inboxMutations?.status).toBe("Inactive");
      expect(String(inboxMutations?.convertedTo ?? "")).toContain("My Project");
    });

    it("handles Link object engagement from inbox note", async () => {
      const inboxFile = new TFile("inbox/Some Task.md");
      const { svc, app } = createEntityService([
        {
          path: "inbox/Some Task.md",
          frontmatter: {
            engagement: { path: "engagements/My Engagement.md", type: "file" },
            status: "Active",
          },
        },
      ]);

      const mutations: Record<string, Record<string, unknown>> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        mutations[file.path] = { ...(mutations[file.path] ?? {}), ...fm };
      };

      await svc.convertInboxToProject(
        inboxFile as unknown as import("obsidian").TFile,
        "My Project"
      );

      // Engagement should be extracted from Link object and set as wikilink
      const projectMutations = mutations["projects/My Project.md"];
      expect(String(projectMutations?.engagement ?? "")).toContain("My Engagement");
    });
  });
});
