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

  describe("createRecurringMeetingEvent", () => {
    it("creates event file in the meetingsRecurringEvents/meetingName folder", async () => {
      const { svc, app } = createEntityService([
        {
          path: "meetings/recurring/Weekly Standup.md",
          frontmatter: { "default-attendees": [] },
        },
      ]);

      const createdFiles: string[] = [];
      app.vault.create = async (path, content) => {
        createdFiles.push(path);
        return new TFile(path);
      };

      await svc.createRecurringMeetingEvent("Weekly Standup");

      expect(createdFiles).toHaveLength(1);
      expect(createdFiles[0]).toContain("meetings/recurring-events/Weekly Standup/");
      expect(createdFiles[0]).toMatch(/\d{4}-\d{2}-\d{2}\.md$/);
    });

    it("sets recurring-meeting wikilink in frontmatter", async () => {
      const { svc, app } = createEntityService([
        {
          path: "meetings/recurring/Weekly Standup.md",
          frontmatter: { "default-attendees": [] },
        },
      ]);

      const mutations: Record<string, Record<string, unknown>> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        mutations[file.path] = { ...(mutations[file.path] ?? {}), ...fm };
      };

      await svc.createRecurringMeetingEvent("Weekly Standup");

      // Find the event file mutation (not the recurring meeting itself)
      const eventPath = Object.keys(mutations).find((p) =>
        p.startsWith("meetings/recurring-events/Weekly Standup/")
      );
      expect(eventPath).toBeDefined();
      expect(String(mutations[eventPath!]?.["recurring-meeting"] ?? "")).toContain(
        "Weekly Standup"
      );
    });

    it("copies default-attendees from parent meeting as wikilinks", async () => {
      const { svc, app } = createEntityService([
        {
          path: "meetings/recurring/Weekly Standup.md",
          frontmatter: { "default-attendees": ["[[Alice]]", "[[Bob]]"] },
        },
      ]);

      const mutations: Record<string, Record<string, unknown>> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        mutations[file.path] = { ...(mutations[file.path] ?? {}), ...fm };
      };

      await svc.createRecurringMeetingEvent("Weekly Standup");

      const eventPath = Object.keys(mutations).find((p) =>
        p.startsWith("meetings/recurring-events/Weekly Standup/")
      );
      expect(eventPath).toBeDefined();
      const attendees = mutations[eventPath!]?.["attendees"];
      expect(Array.isArray(attendees)).toBe(true);
      expect(attendees).toHaveLength(2);
    });

    it("uses explicit attendees when provided in options (overrides default-attendees)", async () => {
      const { svc, app } = createEntityService([
        {
          path: "meetings/recurring/Weekly Standup.md",
          frontmatter: { "default-attendees": ["[[Alice]]", "[[Bob]]"] },
        },
      ]);

      const mutations: Record<string, Record<string, unknown>> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        mutations[file.path] = { ...(mutations[file.path] ?? {}), ...fm };
      };

      await svc.createRecurringMeetingEvent("Weekly Standup", {
        attendees: ["Charlie"],
      });

      const eventPath = Object.keys(mutations).find((p) =>
        p.startsWith("meetings/recurring-events/Weekly Standup/")
      );
      expect(eventPath).toBeDefined();
      const attendees = mutations[eventPath!]?.["attendees"] as string[];
      expect(attendees).toHaveLength(1);
      expect(attendees[0]).toContain("Charlie");
    });

    it("uses provided date when given in options", async () => {
      const { svc, app } = createEntityService([
        {
          path: "meetings/recurring/Weekly Standup.md",
          frontmatter: { "default-attendees": [] },
        },
      ]);

      const createdFiles: string[] = [];
      app.vault.create = async (path, content) => {
        createdFiles.push(path);
        return new TFile(path);
      };

      await svc.createRecurringMeetingEvent("Weekly Standup", { date: "2024-06-15T10:00" });

      expect(createdFiles[0]).toContain("2024-06-15");
    });

    it("injects notesContent into the event file when provided", async () => {
      const templateContent = `---
recurring-meeting:
date:
attendees: []
---

# Properties

# Notes
-
`;
      const { svc, app } = createEntityService([
        {
          path: "meetings/recurring/Weekly Standup.md",
          frontmatter: { "default-attendees": [] },
        },
      ]);

      // Return the template content when the event file is read
      app.vault.read = async (_file) => templateContent;

      let modifiedContent = "";
      app.vault.modify = async (_file, content) => {
        modifiedContent = content;
      };

      await svc.createRecurringMeetingEvent("Weekly Standup", {
        notesContent: "- Action item 1",
      });

      expect(modifiedContent).toContain("Action item 1");
    });

    it("does not open file when open: false is set", async () => {
      const { svc, app } = createEntityService([
        {
          path: "meetings/recurring/Weekly Standup.md",
          frontmatter: { "default-attendees": [] },
        },
      ]);

      const leaf = { openFile: vi.fn(async () => {}) };
      app.workspace.getLeaf = () => leaf as unknown as ReturnType<typeof app.workspace.getLeaf>;

      await svc.createRecurringMeetingEvent("Weekly Standup", { open: false });

      expect(leaf.openFile).not.toHaveBeenCalled();
    });

    it("updates parent meeting's last-event-date to the event date", async () => {
      const { svc, app } = createEntityService([
        {
          path: "meetings/recurring/Weekly Standup.md",
          frontmatter: { "default-attendees": [] },
        },
      ]);

      const mutations: Record<string, Record<string, unknown>> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        mutations[file.path] = { ...(mutations[file.path] ?? {}), ...fm };
      };

      await svc.createRecurringMeetingEvent("Weekly Standup", { date: "2024-06-15" });

      const parentPath = "meetings/recurring/Weekly Standup.md";
      expect(mutations[parentPath]?.["last-event-date"]).toBe("2024-06-15");
    });

    it("does not crash when parent meeting file does not exist", async () => {
      const { svc, app } = createEntityService();

      const mutations: Record<string, Record<string, unknown>> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        mutations[file.path] = { ...(mutations[file.path] ?? {}), ...fm };
      };

      // No parent file registered — should not throw
      await expect(
        svc.createRecurringMeetingEvent("Nonexistent Meeting", { open: false })
      ).resolves.not.toThrow();

      // Parent path should NOT have been updated since TFile check fails
      const parentPath = "meetings/recurring/Nonexistent Meeting.md";
      expect(mutations[parentPath]?.["last-event-date"]).toBeUndefined();
    });
  });

  describe("convertSingleToRecurring", () => {
    it("creates a recurring meeting and a first event, then deletes the single meeting", async () => {
      const singleFile = new TFile("meetings/single/Weekly Standup.md");
      const singleContent = `---
engagement: "[[My Engagement]]"
date: 2024-03-15T10:00
attendees:
  - "[[Alice]]"
---

# Notes
- Key takeaway
`;
      const { svc, app } = createEntityService([
        {
          path: "meetings/single/Weekly Standup.md",
          content: singleContent,
          frontmatter: {
            engagement: "[[My Engagement]]",
            date: "2024-03-15T10:00",
            attendees: ["[[Alice]]"],
          },
        },
      ]);

      const createdFiles: string[] = [];
      app.vault.create = async (path, content) => {
        createdFiles.push(path);
        return new TFile(path);
      };

      const deletedFiles: string[] = [];
      app.vault.delete = async (file) => {
        deletedFiles.push(file.path);
      };

      await svc.convertSingleToRecurring(
        singleFile as unknown as import("obsidian").TFile,
        "Weekly Standup"
      );

      // Recurring meeting should be created
      expect(createdFiles.some((p) => p.startsWith("meetings/recurring/"))).toBe(true);
      // Event should be created in the events subfolder
      expect(createdFiles.some((p) => p.startsWith("meetings/recurring-events/"))).toBe(true);
      // Original single meeting should be deleted
      expect(deletedFiles).toContain("meetings/single/Weekly Standup.md");
    });

    it("copies engagement from single meeting to recurring meeting", async () => {
      const singleFile = new TFile("meetings/single/Weekly Standup.md");
      const { svc, app } = createEntityService([
        {
          path: "meetings/single/Weekly Standup.md",
          content: "",
          frontmatter: {
            engagement: "[[My Engagement]]",
            date: "2024-03-15T10:00",
            attendees: [],
          },
        },
      ]);

      const mutations: Record<string, Record<string, unknown>> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        mutations[file.path] = { ...(mutations[file.path] ?? {}), ...fm };
      };

      await svc.convertSingleToRecurring(
        singleFile as unknown as import("obsidian").TFile,
        "Weekly Standup"
      );

      const recurringPath = "meetings/recurring/Weekly Standup.md";
      expect(String(mutations[recurringPath]?.["engagement"] ?? "")).toContain("My Engagement");
    });

    it("sets default-attendees on the recurring meeting from single meeting attendees", async () => {
      const singleFile = new TFile("meetings/single/Weekly Standup.md");
      const { svc, app } = createEntityService([
        {
          path: "meetings/single/Weekly Standup.md",
          content: "",
          frontmatter: {
            engagement: "",
            date: "2024-03-15T10:00",
            attendees: ["[[Alice]]", "[[Bob]]"],
          },
        },
      ]);

      const mutations: Record<string, Record<string, unknown>> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        mutations[file.path] = { ...(mutations[file.path] ?? {}), ...fm };
      };

      await svc.convertSingleToRecurring(
        singleFile as unknown as import("obsidian").TFile,
        "Weekly Standup"
      );

      const recurringPath = "meetings/recurring/Weekly Standup.md";
      const defaultAttendees = mutations[recurringPath]?.["default-attendees"];
      expect(Array.isArray(defaultAttendees)).toBe(true);
      expect((defaultAttendees as string[]).some((a) => String(a).includes("Alice"))).toBe(true);
      expect((defaultAttendees as string[]).some((a) => String(a).includes("Bob"))).toBe(true);
    });

    it("sets last-event-date on the recurring meeting when converting from single", async () => {
      const singleFile = new TFile("meetings/single/Weekly Standup.md");
      const { svc, app } = createEntityService([
        {
          path: "meetings/single/Weekly Standup.md",
          content: "",
          frontmatter: {
            engagement: "",
            date: "2024-03-15T10:00",
            attendees: [],
          },
        },
        // The recurring meeting file will be created, but we also need it registered for the parent lookup
        {
          path: "meetings/recurring/Weekly Standup.md",
          frontmatter: { "default-attendees": [] },
        },
      ]);

      const mutations: Record<string, Record<string, unknown>> = {};
      app.fileManager.processFrontMatter = async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        mutations[file.path] = { ...(mutations[file.path] ?? {}), ...fm };
      };

      await svc.convertSingleToRecurring(
        singleFile as unknown as import("obsidian").TFile,
        "Weekly Standup"
      );

      const recurringPath = "meetings/recurring/Weekly Standup.md";
      expect(mutations[recurringPath]?.["last-event-date"]).toBe("2024-03-15");
    });

    it("uses single meeting basename as recurring name when recurringName is not provided", async () => {
      const singleFile = new TFile("meetings/single/Team Sync.md");
      const { svc, app } = createEntityService([
        {
          path: "meetings/single/Team Sync.md",
          content: "",
          frontmatter: {
            engagement: "",
            date: "2024-03-15T10:00",
            attendees: [],
          },
        },
      ]);

      const createdFiles: string[] = [];
      app.vault.create = async (path, content) => {
        createdFiles.push(path);
        return new TFile(path);
      };

      await svc.convertSingleToRecurring(
        singleFile as unknown as import("obsidian").TFile
      );

      expect(createdFiles.some((p) => p.includes("Team Sync"))).toBe(true);
    });
  });
});
