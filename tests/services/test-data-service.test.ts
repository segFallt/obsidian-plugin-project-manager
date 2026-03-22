import { describe, it, expect, vi, beforeEach } from "vitest";
import { TestDataService } from "../../src/services/test-data-service";
import { TemplateService } from "../../src/services/template-service";
import { createMockApp, TFile } from "../mocks/app-mock";
import { DEFAULT_SETTINGS } from "../../src/settings";
import type { ILoggerService } from "../../src/services/interfaces";
import {
  TEST_PREFIX,
  TASKS_PER_ENTITY,
  ENTITIES_PER_TYPE,
  REFERENCE_TOPIC_NAMES,
  REFERENCE_NAMES,
} from "../../src/services/test-data-constants";

// 9 entity types × 10 each, plus reference topics (12) and references (12)
const ENTITY_TYPE_COUNT = 9;
const TOTAL_FILES =
  ENTITY_TYPE_COUNT * ENTITIES_PER_TYPE +
  REFERENCE_TOPIC_NAMES.length +
  REFERENCE_NAMES.length;
const TOTAL_TASKS = TOTAL_FILES * TASKS_PER_ENTITY;

function createMockLogger(): ILoggerService {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: vi.fn().mockResolvedValue(undefined),
    cleanOldLogs: vi.fn().mockResolvedValue(undefined),
  };
}

function createService() {
  const app = createMockApp([]);
  const createdPaths: string[] = [];
  const createdContents: string[] = [];

  // Wrap vault.create to track calls without replacing mock implementation
  const originalCreate = app.vault.create.bind(app.vault);
  app.vault.create = vi.fn(async (path: string, content: string) => {
    createdPaths.push(path);
    createdContents.push(content);
    return originalCreate(path, content);
  }) as typeof app.vault.create;

  const deletedPaths: string[] = [];
  app.vault.delete = vi.fn(async (file: TFile) => {
    deletedPaths.push(file.path);
  }) as typeof app.vault.delete;

  const templateService = new TemplateService();
  const loggerService = createMockLogger();
  const settings = structuredClone(DEFAULT_SETTINGS);

  const svc = new TestDataService(
    app as unknown as import("obsidian").App,
    settings,
    templateService,
    loggerService
  );

  return { svc, app, createdPaths, createdContents, deletedPaths, loggerService };
}

describe("TestDataService", () => {
  describe("generateTestData", () => {
    it(`generates exactly ${TOTAL_FILES} files total`, async () => {
      const { svc, createdPaths } = createService();
      await svc.generateTestData();
      expect(createdPaths).toHaveLength(TOTAL_FILES);
    });

    it(`returns totalFiles = ${TOTAL_FILES}`, async () => {
      const { svc } = createService();
      const result = await svc.generateTestData();
      expect(result.totalFiles).toBe(TOTAL_FILES);
    });

    it(`returns totalTasks = ${TOTAL_TASKS}`, async () => {
      const { svc } = createService();
      const result = await svc.generateTestData();
      expect(result.totalTasks).toBe(TOTAL_TASKS);
    });

    it("returns no errors on success", async () => {
      const { svc } = createService();
      const result = await svc.generateTestData();
      expect(result.errors).toHaveLength(0);
    });

    it("all created file names include TEST - prefix (except recurring event date files)", async () => {
      const { svc, createdPaths } = createService();
      await svc.generateTestData();
      // Recurring meeting events are named by date (e.g. 2026-03-10.md), not with TEST - prefix.
      // All other entity types use the TEST - prefix.
      const nonEventPaths = createdPaths.filter((p) => !p.startsWith("meetings/recurring-events/"));
      for (const path of nonEventPaths) {
        const basename = path.split("/").pop() ?? "";
        expect(basename).toMatch(/^TEST -/);
      }
    });

    it("creates 10 clients in the clients folder", async () => {
      const { svc, createdPaths } = createService();
      await svc.generateTestData();
      const clientFiles = createdPaths.filter((p) => p.startsWith("clients/"));
      expect(clientFiles).toHaveLength(ENTITIES_PER_TYPE);
    });

    it("creates 10 people in the people folder", async () => {
      const { svc, createdPaths } = createService();
      await svc.generateTestData();
      const files = createdPaths.filter((p) => p.startsWith("people/"));
      expect(files).toHaveLength(ENTITIES_PER_TYPE);
    });

    it("creates 10 engagements in the engagements folder", async () => {
      const { svc, createdPaths } = createService();
      await svc.generateTestData();
      const files = createdPaths.filter((p) => p.startsWith("engagements/"));
      expect(files).toHaveLength(ENTITIES_PER_TYPE);
    });

    it("creates 10 projects in the projects folder", async () => {
      const { svc, createdPaths } = createService();
      await svc.generateTestData();
      const files = createdPaths.filter((p) => p.startsWith("projects/") && !p.includes("/notes/"));
      expect(files).toHaveLength(ENTITIES_PER_TYPE);
    });

    it("creates 10 inbox notes in the inbox folder", async () => {
      const { svc, createdPaths } = createService();
      await svc.generateTestData();
      const files = createdPaths.filter((p) => p.startsWith("inbox/"));
      expect(files).toHaveLength(ENTITIES_PER_TYPE);
    });

    it("creates 10 single meetings in the meetingsSingle folder", async () => {
      const { svc, createdPaths } = createService();
      await svc.generateTestData();
      const files = createdPaths.filter((p) => p.startsWith("meetings/single/"));
      expect(files).toHaveLength(ENTITIES_PER_TYPE);
    });

    it("creates 10 recurring meetings in the meetingsRecurring folder", async () => {
      const { svc, createdPaths } = createService();
      await svc.generateTestData();
      const files = createdPaths.filter((p) => p.startsWith("meetings/recurring/") && !p.includes("recurring-events"));
      expect(files).toHaveLength(ENTITIES_PER_TYPE);
    });

    it("creates 10 project notes under projects/notes", async () => {
      const { svc, createdPaths } = createService();
      await svc.generateTestData();
      const files = createdPaths.filter((p) => p.startsWith("projects/notes/"));
      expect(files).toHaveLength(ENTITIES_PER_TYPE);
    });

    it("creates 10 recurring meeting events under meetings/recurring-events", async () => {
      const { svc, createdPaths } = createService();
      await svc.generateTestData();
      const files = createdPaths.filter((p) => p.startsWith("meetings/recurring-events/"));
      expect(files).toHaveLength(ENTITIES_PER_TYPE);
    });

    it("each file content contains exactly 5 task lines", async () => {
      const { svc, createdContents } = createService();
      await svc.generateTestData();
      for (const content of createdContents) {
        const taskLines = content.split("\n").filter((l) => l.startsWith("- [ ]"));
        expect(taskLines).toHaveLength(TASKS_PER_ENTITY);
      }
    });

    it("task lines contain a due date emoji and ISO date", async () => {
      const { svc, createdContents } = createService();
      await svc.generateTestData();
      for (const content of createdContents) {
        const taskLines = content.split("\n").filter((l) => l.startsWith("- [ ]"));
        for (const line of taskLines) {
          expect(line).toMatch(/📅 \d{4}-\d{2}-\d{2}/);
        }
      }
    });

    it("task lines use valid priority emojis or no emoji", async () => {
      const { svc, createdContents } = createService();
      await svc.generateTestData();
      const validPriorityPattern = /^- \[ \] .+( [⏫🔼🔽⏬])? 📅 \d{4}-\d{2}-\d{2}$/;
      for (const content of createdContents) {
        const taskLines = content.split("\n").filter((l) => l.startsWith("- [ ]"));
        for (const line of taskLines) {
          expect(line).toMatch(validPriorityPattern);
        }
      }
    });

    it("task indices 0-1 have past due dates, indices 2-4 have future due dates", async () => {
      const { svc, createdContents } = createService();
      await svc.generateTestData();

      const today = new Date().toISOString().slice(0, 10);

      for (const content of createdContents) {
        const taskLines = content.split("\n").filter((l) => l.startsWith("- [ ]"));
        expect(taskLines).toHaveLength(TASKS_PER_ENTITY);

        const dueDates = taskLines.map((l) => {
          const m = l.match(/📅 (\d{4}-\d{2}-\d{2})/);
          return m?.[1] ?? "";
        });

        // Indices 0-1: past dates (ISO string lexicographic comparison works correctly)
        expect(dueDates[0] < today).toBe(true);
        expect(dueDates[1] < today).toBe(true);
        // Indices 2-4: future dates
        expect(dueDates[2] > today).toBe(true);
        expect(dueDates[3] > today).toBe(true);
        expect(dueDates[4] > today).toBe(true);
      }
    });

    it("engagement frontmatter references a test client wikilink", async () => {
      const { svc, app } = createService();
      const fmWrites: Array<{ path: string; fm: Record<string, unknown> }> = [];
      const originalFm = app.fileManager.processFrontMatter.bind(app.fileManager);
      app.fileManager.processFrontMatter = vi.fn(async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        fmWrites.push({ path: file.path, fm });
        return originalFm(file, fn);
      }) as typeof app.fileManager.processFrontMatter;

      await svc.generateTestData();

      const engagementFmWrites = fmWrites.filter((w) => w.path.startsWith("engagements/"));
      for (const { fm } of engagementFmWrites) {
        const client = String(fm.client ?? "");
        expect(client).toMatch(/^\[\[TEST -.*\]\]$/);
      }
    });

    it("project frontmatter references a test engagement wikilink", async () => {
      const { svc, app } = createService();
      const fmWrites: Array<{ path: string; fm: Record<string, unknown> }> = [];
      const originalFm = app.fileManager.processFrontMatter.bind(app.fileManager);
      app.fileManager.processFrontMatter = vi.fn(async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        fmWrites.push({ path: file.path, fm });
        return originalFm(file, fn);
      }) as typeof app.fileManager.processFrontMatter;

      await svc.generateTestData();

      const projectFmWrites = fmWrites.filter(
        (w) => w.path.startsWith("projects/") && !w.path.includes("/notes/")
      );
      for (const { fm } of projectFmWrites) {
        const engagement = String(fm.engagement ?? "");
        expect(engagement).toMatch(/^\[\[TEST -.*\]\]$/);
      }
    });

    it("person frontmatter references a test client wikilink", async () => {
      const { svc, app } = createService();
      const fmWrites: Array<{ path: string; fm: Record<string, unknown> }> = [];
      const originalFm = app.fileManager.processFrontMatter.bind(app.fileManager);
      app.fileManager.processFrontMatter = vi.fn(async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        fmWrites.push({ path: file.path, fm });
        return originalFm(file, fn);
      }) as typeof app.fileManager.processFrontMatter;

      await svc.generateTestData();

      const personFmWrites = fmWrites.filter((w) => w.path.startsWith("people/"));
      for (const { fm } of personFmWrites) {
        const client = String(fm.client ?? "");
        expect(client).toMatch(/^\[\[TEST -.*\]\]$/);
      }
    });

    it("inbox frontmatter references a test engagement wikilink", async () => {
      const { svc, app } = createService();
      const fmWrites: Array<{ path: string; fm: Record<string, unknown> }> = [];
      const originalFm = app.fileManager.processFrontMatter.bind(app.fileManager);
      app.fileManager.processFrontMatter = vi.fn(async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        fmWrites.push({ path: file.path, fm });
        return originalFm(file, fn);
      }) as typeof app.fileManager.processFrontMatter;

      await svc.generateTestData();

      const inboxFmWrites = fmWrites.filter((w) => w.path.startsWith("inbox/"));
      for (const { fm } of inboxFmWrites) {
        const engagement = String(fm.engagement ?? "");
        expect(engagement).toMatch(/^\[\[TEST -.*\]\]$/);
      }
    });

    it("project note frontmatter references a test project wikilink", async () => {
      const { svc, app } = createService();
      const fmWrites: Array<{ path: string; fm: Record<string, unknown> }> = [];
      const originalFm = app.fileManager.processFrontMatter.bind(app.fileManager);
      app.fileManager.processFrontMatter = vi.fn(async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        fmWrites.push({ path: file.path, fm });
        return originalFm(file, fn);
      }) as typeof app.fileManager.processFrontMatter;

      await svc.generateTestData();

      const noteFmWrites = fmWrites.filter((w) => w.path.startsWith("projects/notes/"));
      for (const { fm } of noteFmWrites) {
        const project = String(fm.relatedProject ?? "");
        expect(project).toMatch(/^\[\[TEST -.*\]\]$/);
      }
    });

    it("recurring meeting event frontmatter references a test recurring meeting", async () => {
      const { svc, app } = createService();
      const fmWrites: Array<{ path: string; fm: Record<string, unknown> }> = [];
      const originalFm = app.fileManager.processFrontMatter.bind(app.fileManager);
      app.fileManager.processFrontMatter = vi.fn(async (file, fn) => {
        const fm: Record<string, unknown> = {};
        fn(fm);
        fmWrites.push({ path: file.path, fm });
        return originalFm(file, fn);
      }) as typeof app.fileManager.processFrontMatter;

      await svc.generateTestData();

      const eventFmWrites = fmWrites.filter((w) => w.path.startsWith("meetings/recurring-events/"));
      for (const { fm } of eventFmWrites) {
        const meeting = String(fm["recurring-meeting"] ?? "");
        expect(meeting).toMatch(/^\[\[TEST -.*\]\]$/);
      }
    });

    it("tasks are placed under # Notes heading", async () => {
      const { svc, createdContents } = createService();
      await svc.generateTestData();
      for (const content of createdContents) {
        const notesIdx = content.indexOf("# Notes\n");
        expect(notesIdx).toBeGreaterThan(-1);
        const afterNotes = content.slice(notesIdx + "# Notes\n".length);
        const firstTask = afterNotes.trimStart().slice(0, 5);
        expect(firstTask).toBe("- [ ]");
      }
    });
  });

  describe("generateTestData — error handling", () => {
    it("continues past a single vault.create failure and collects the error", async () => {
      const { svc, app } = createService();
      let callCount = 0;
      const originalCreate = app.vault.create.bind(app.vault);
      app.vault.create = vi.fn(async (path: string, content: string) => {
        callCount++;
        if (callCount === 1) throw new Error("Simulated failure");
        return originalCreate(path, content);
      }) as typeof app.vault.create;

      const result = await svc.generateTestData();

      // One failure means 89 successes
      expect(result.totalFiles).toBe(TOTAL_FILES - 1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe("cleanTestData", () => {
    it("deletes all TEST - prefixed files and returns count", async () => {
      const testFiles = [
        { path: "clients/TEST - Acme.md", content: "" },
        { path: "projects/TEST - Alpha.md", content: "" },
        { path: "engagements/TEST - Beta.md", content: "" },
        { path: "people/Real Person.md", content: "" },
      ];
      const app = createMockApp(testFiles);
      const deletedPaths: string[] = [];
      app.vault.delete = vi.fn(async (file: TFile) => {
        deletedPaths.push(file.path);
      }) as typeof app.vault.delete;

      const svc = new TestDataService(
        app as unknown as import("obsidian").App,
        structuredClone(DEFAULT_SETTINGS),
        new TemplateService(),
        createMockLogger()
      );

      const count = await svc.cleanTestData();

      expect(count).toBe(3);
      expect(deletedPaths).toHaveLength(3);
      expect(deletedPaths).not.toContain("people/Real Person.md");
    });

    it("deletes date-named event files inside TEST - prefixed folders", async () => {
      const testFiles = [
        { path: "meetings/recurring-events/TEST - Weekly Sync/2026-03-10.md", content: "" },
        { path: "meetings/recurring-events/TEST - Daily Standup/2026-03-10.md", content: "" },
        { path: "meetings/recurring-events/Real Meeting/2026-03-10.md", content: "" },
      ];
      const app = createMockApp(testFiles);
      const deletedPaths: string[] = [];
      app.vault.delete = vi.fn(async (file: TFile) => {
        deletedPaths.push(file.path);
      }) as typeof app.vault.delete;

      const svc = new TestDataService(
        app as unknown as import("obsidian").App,
        structuredClone(DEFAULT_SETTINGS),
        new TemplateService(),
        createMockLogger()
      );

      const count = await svc.cleanTestData();

      expect(count).toBe(2);
      expect(deletedPaths).toContain(
        "meetings/recurring-events/TEST - Weekly Sync/2026-03-10.md"
      );
      expect(deletedPaths).toContain(
        "meetings/recurring-events/TEST - Daily Standup/2026-03-10.md"
      );
      expect(deletedPaths).not.toContain(
        "meetings/recurring-events/Real Meeting/2026-03-10.md"
      );
    });

    it("returns 0 when no test files exist", async () => {
      const app = createMockApp([{ path: "clients/Real Client.md", content: "" }]);
      const svc = new TestDataService(
        app as unknown as import("obsidian").App,
        structuredClone(DEFAULT_SETTINGS),
        new TemplateService(),
        createMockLogger()
      );
      const count = await svc.cleanTestData();
      expect(count).toBe(0);
    });

    it("only deletes files whose basename starts with TEST -", async () => {
      const testFiles = [
        { path: "clients/TEST - Foo.md", content: "" },
        { path: "clients/Not A Test.md", content: "" },
        { path: "projects/TEST - Bar.md", content: "" },
      ];
      const app = createMockApp(testFiles);
      const deletedPaths: string[] = [];
      app.vault.delete = vi.fn(async (file: TFile) => {
        deletedPaths.push(file.path);
      }) as typeof app.vault.delete;

      const svc = new TestDataService(
        app as unknown as import("obsidian").App,
        structuredClone(DEFAULT_SETTINGS),
        new TemplateService(),
        createMockLogger()
      );

      await svc.cleanTestData();

      expect(deletedPaths).toContain("clients/TEST - Foo.md");
      expect(deletedPaths).toContain("projects/TEST - Bar.md");
      expect(deletedPaths).not.toContain("clients/Not A Test.md");
    });

    it(`re-running generateTestData after clean produces another ${TOTAL_FILES} files`, async () => {
      const { svc, createdPaths } = createService();

      await svc.generateTestData();
      const firstRun = createdPaths.length;

      await svc.cleanTestData();

      // Reset tracking
      createdPaths.length = 0;
      await svc.generateTestData();

      expect(firstRun).toBe(TOTAL_FILES);
      // Second run creates another TOTAL_FILES (with conflict-resolution suffixes)
      expect(createdPaths).toHaveLength(TOTAL_FILES);
    });
  });
});
