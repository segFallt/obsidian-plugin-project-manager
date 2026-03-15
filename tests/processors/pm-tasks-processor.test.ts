import { describe, it, expect, vi, afterEach } from "vitest";
import { registerPmTasksProcessor, _clearFilterStateCacheForTests } from "../../src/processors/pm-tasks-processor";

afterEach(() => { _clearFilterStateCacheForTests(); });
import { createMockDataviewApi } from "../mocks/dataview-mock";
import type { DataviewApi } from "../../src/types";
import type { TaskProcessorServices, RegisterProcessorFn } from "../../src/plugin-context";
import { DEFAULT_FOLDERS } from "../../src/constants";
import { TaskFilterService } from "../../src/services/task-filter-service";
import { TaskSortService } from "../../src/services/task-sort-service";

// ─── Mock services factory ───────────────────────────────────────────────────

function createMockServices(dvApi: DataviewApi | null = null) {
  let registeredHandler:
    | ((source: string, el: HTMLElement, ctx: Record<string, unknown>) => void)
    | null = null;

  const vaultOn = vi.fn(() => ({ id: "mock-event" }));

  const registerProcessor: RegisterProcessorFn = vi.fn(
    (
      _lang: string,
      handler: (
        source: string,
        el: HTMLElement,
        ctx: Record<string, unknown>
      ) => void
    ) => {
      registeredHandler = handler;
    }
  );

  const services = {
    app: {
      vault: {
        on: vaultOn,
        getAbstractFileByPath: vi.fn(() => null),
        read: vi.fn(async () => ""),
        modify: vi.fn(async () => {}),
      },
    },
    settings: {
      folders: DEFAULT_FOLDERS,
      ui: {
        defaultTaskViewMode: "context",
        showCompletedByDefault: false,
      },
    },
    queryService: {
      dv: vi.fn(() => dvApi),
      getActiveEntitiesByTag: vi.fn(() => []),
      getPage: vi.fn(() => null),
    },
    taskParser: {
      toggleTaskLine: vi.fn((line: string) => line),
    },
    loggerService: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
    filterService: new TaskFilterService(DEFAULT_FOLDERS),
    sortService: new TaskSortService(),
  } as unknown as TaskProcessorServices;

  return {
    services,
    registerProcessor,
    vaultOn,
    getHandler: () => registeredHandler!,
  };
}

// ─── Render helper ──────────────────────────────────────────────────────────

function render(source: string, dvApi: DataviewApi | null = null) {
  const { services, registerProcessor, vaultOn, getHandler } = createMockServices(dvApi);
  registerPmTasksProcessor(services, registerProcessor);

  const el = document.createElement("div");
  const children: unknown[] = [];
  const ctx = {
    addChild: (child: unknown) => children.push(child),
    sourcePath: "test.md",
  };

  getHandler()(source, el, ctx as unknown as Record<string, unknown>);
  return {
    el,
    services,
    vaultOn,
    child: children[0] as { onload?: () => void; onunload?: () => void },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("pm-tasks processor", () => {
  it("registers a 'pm-tasks' code block processor", () => {
    const { services, registerProcessor } = createMockServices();
    registerPmTasksProcessor(services, registerProcessor);
    expect(registerProcessor).toHaveBeenCalledWith(
      "pm-tasks",
      expect.any(Function)
    );
  });

  // ─── Error paths ──────────────────────────────────────────────────────────

  describe("render() — error paths", () => {
    it("shows error when mode is missing", () => {
      const { el } = render("sortBy: none");
      const err = el.querySelector(".pm-error");
      expect(err).not.toBeNull();
      expect(err!.textContent).toContain("mode");
    });

    it("shows error for unknown mode", () => {
      const { el } = render("mode: unknown");
      const err = el.querySelector(".pm-error");
      expect(err).not.toBeNull();
      expect(err!.textContent).toContain("unknown");
    });

    it("shows error when source is empty (mode missing)", () => {
      const { el } = render("");
      expect(el.querySelector(".pm-error")).not.toBeNull();
    });
  });

  // ─── Dashboard mode ───────────────────────────────────────────────────────

  describe("dashboard mode", () => {
    it("renders dashboard container and controls", () => {
      const { el } = render("mode: dashboard");
      expect(el.querySelector(".pm-tasks-dashboard")).not.toBeNull();
      expect(el.querySelector(".pm-tasks-dashboard__controls")).not.toBeNull();
      expect(el.querySelector(".pm-tasks-dashboard__output")).not.toBeNull();
    });

    it("renders view-mode and sort selects in controls", () => {
      const { el } = render("mode: dashboard");
      const selects = el.querySelectorAll("select");
      // At minimum: view, sort, inbox status, meeting date, and filter selects
      expect(selects.length).toBeGreaterThan(0);
    });

    it("renders show-completed checkbox in controls", () => {
      const { el } = render("mode: dashboard");
      const checkboxes = el.querySelectorAll("input[type='checkbox']");
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it("renders collapsible filter sections", () => {
      const { el } = render("mode: dashboard");
      const details = el.querySelectorAll("details");
      expect(details.length).toBeGreaterThanOrEqual(3); // Context, Date, Priority
    });

    it("renders Clear Filters button", () => {
      const { el } = render("mode: dashboard");
      const buttons = [...el.querySelectorAll("button")];
      expect(buttons.some((b) => b.textContent === "Clear Filters")).toBe(true);
    });

    it("shows Dataview-not-available message when dv() returns null", () => {
      const { el } = render("mode: dashboard");
      const output = el.querySelector(".pm-tasks-dashboard__output");
      expect(output).not.toBeNull();
      expect(output!.textContent).toContain("Dataview");
    });

    it("shows 'no tasks match' message when dv returns no tasks", () => {
      const dvApi = createMockDataviewApi([]);
      const { el } = render("mode: dashboard", dvApi);
      const output = el.querySelector(".pm-tasks-dashboard__output");
      expect(output!.textContent).toContain("No tasks match");
    });

    it("renders tasks in context view (default)", () => {
      const dvApi = createMockDataviewApi([
        {
          path: "projects/Alpha.md",
          tasks: [{ text: "Task A 📅 2030-06-01", due: "2030-06-01" }],
        },
      ]);
      const { el } = render("mode: dashboard\nviewMode: context", dvApi);
      const output = el.querySelector(".pm-tasks-dashboard__output");
      expect(output).not.toBeNull();
      // Should render "Project" context heading
      const headings = output!.querySelectorAll("h2");
      const texts = [...headings].map((h) => h.textContent ?? "");
      expect(texts).toContain("Project");
    });

    it("renders tasks in date view", () => {
      const dvApi = createMockDataviewApi([
        {
          path: "projects/Alpha.md",
          tasks: [{ text: "Task B 📅 2030-06-01", due: "2030-06-01" }],
        },
      ]);
      const { el } = render("mode: dashboard\nviewMode: date", dvApi);
      const output = el.querySelector(".pm-tasks-dashboard__output");
      expect(output).not.toBeNull();
    });

    it("renders tasks in priority view", () => {
      const dvApi = createMockDataviewApi([
        {
          path: "projects/Alpha.md",
          tasks: [{ text: "Urgent task ⏫" }],
        },
      ]);
      const { el } = render("mode: dashboard\nviewMode: priority", dvApi);
      const output = el.querySelector(".pm-tasks-dashboard__output");
      expect(output).not.toBeNull();
    });

    it("renders tasks in tag view", () => {
      const dvApi = createMockDataviewApi([
        {
          path: "projects/Alpha.md",
          tasks: [{ text: "Tagged task", tags: ["#work"] }],
        },
      ]);
      const { el } = render("mode: dashboard\nviewMode: tag", dvApi);
      const output = el.querySelector(".pm-tasks-dashboard__output");
      expect(output).not.toBeNull();
    });

    it("renders task list items with checkboxes", () => {
      const dvApi = createMockDataviewApi([
        {
          path: "projects/Beta.md",
          tasks: [{ text: "Checkbox task" }],
        },
      ]);
      const { el } = render("mode: dashboard\nviewMode: context", dvApi);
      const checkboxes = el.querySelectorAll(".task-list-item-checkbox");
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it("renders due date badge on tasks with due dates", () => {
      const dvApi = createMockDataviewApi([
        {
          path: "projects/Beta.md",
          tasks: [{ text: "Due task 📅 2030-01-15", due: "2030-01-15" }],
        },
      ]);
      const { el } = render("mode: dashboard\nviewMode: context", dvApi);
      const badges = el.querySelectorAll(".pm-task-due");
      expect(badges.length).toBeGreaterThan(0);
    });

    it("renders untagged group in tag view", () => {
      const dvApi = createMockDataviewApi([
        {
          path: "projects/Beta.md",
          tasks: [{ text: "No tag task", tags: [] }],
        },
      ]);
      const { el } = render("mode: dashboard\nviewMode: tag", dvApi);
      const output = el.querySelector(".pm-tasks-dashboard__output");
      expect(output!.textContent).toContain("Untagged");
    });

    it("reads sortBy from config", () => {
      const dvApi = createMockDataviewApi([
        {
          path: "projects/Alpha.md",
          tasks: [
            { text: "Task A 📅 2030-01-01", due: "2030-01-01" },
            { text: "Task B 📅 2030-06-01", due: "2030-06-01" },
          ],
        },
      ]);
      const { el } = render(
        "mode: dashboard\nviewMode: context\nsortBy: dueDate-asc",
        dvApi
      );
      expect(el.querySelector(".pm-tasks-dashboard")).not.toBeNull();
    });

    it("context view: does not crash when project-note tasks share a parentProject with direct project tasks", () => {
      // Regression test for the projectNoteMapping initialization bug:
      // When byFile[parentProjectPath] is already set (because the project file has a direct task),
      // projectNoteMapping[parentProjectPath] must still be initialized before accessing it.
      const dvApi = createMockDataviewApi([
        {
          // The project file itself — has a direct task, so byFile[projectPath] is created first.
          path: "projects/Alpha.md",
          tags: ["#project"],
          frontmatter: { status: "Active" },
          tasks: [{ text: "Direct project task" }],
        },
        {
          // A project-note file whose relatedProject points to Alpha —
          // triggers the secondary byFile lookup that previously crashed.
          path: "projects/notes/AlphaNote.md",
          frontmatter: { relatedProject: "[[Alpha]]" },
          tasks: [{ text: "Project note task" }],
        },
      ]);

      // The mock dv.page() needs to resolve "projects/Alpha.md" so getParentProjectPath works.
      // createMockDataviewApi already builds a pageMap from MockPageData paths, so the project
      // page is accessible. The project-note page has relatedProject = "[[Alpha]]" which
      // normalizeToName extracts as "Alpha", and the path is constructed as
      // `${folders.projects}/Alpha.md` = "projects/Alpha.md".

      let threw = false;
      try {
        render("mode: dashboard\nviewMode: context", dvApi);
      } catch {
        threw = true;
      }

      expect(threw).toBe(false);
    });
  });

  // ─── By-project mode ─────────────────────────────────────────────────────

  describe("by-project mode", () => {
    it("renders by-project container and controls", () => {
      const { el } = render("mode: by-project");
      expect(el.querySelector(".pm-tasks-by-project")).not.toBeNull();
      expect(
        el.querySelector(".pm-tasks-by-project__controls")
      ).not.toBeNull();
      expect(el.querySelector(".pm-tasks-by-project__output")).not.toBeNull();
    });

    it("renders project filter input", () => {
      const { el } = render("mode: by-project");
      const input = el.querySelector(".pm-tasks-search");
      expect(input).not.toBeNull();
    });

    it("shows Dataview-not-available message when dv() returns null", () => {
      const { el } = render("mode: by-project");
      const output = el.querySelector(".pm-tasks-by-project__output");
      expect(output!.textContent).toContain("Dataview");
    });

    it("shows 'no projects match' when dv returns no matching projects", () => {
      const dvApi = createMockDataviewApi([]);
      const { el } = render("mode: by-project", dvApi);
      const output = el.querySelector(".pm-tasks-by-project__output");
      expect(output!.textContent).toContain("No projects");
    });

    it("renders project groups for matching projects", () => {
      const dvApi = createMockDataviewApi([
        {
          path: "projects/Alpha.md",
          tags: ["#project"],
          frontmatter: { status: "Active", priority: 1 },
          tasks: [{ text: "Project task" }],
        },
      ]);
      const { el } = render("mode: by-project", dvApi);
      const output = el.querySelector(".pm-tasks-by-project__output");
      expect(output).not.toBeNull();
      // Project group should be rendered
      const groups = output!.querySelectorAll(".pm-tasks-project-group");
      expect(groups.length).toBeGreaterThan(0);
    });

    it("renders completed tasks in collapsible when showCompleted is true", () => {
      const dvApi = createMockDataviewApi([
        {
          path: "projects/Alpha.md",
          tags: ["#project"],
          frontmatter: { status: "Active", priority: 1 },
          tasks: [
            { text: "Done task", completed: true },
          ],
        },
      ]);
      const { el } = render("mode: by-project\nshowCompleted: true", dvApi);
      const details = el.querySelectorAll(".pm-tasks-completed");
      expect(details.length).toBeGreaterThan(0);
    });
  });

  // ─── In-memory filter cache ───────────────────────────────────────────────

  describe("in-memory filter cache", () => {
    it("loadSavedFilters returns cached state immediately after debouncedSaveFilters is called", () => {
      // First render — click a date preset button to trigger debouncedSaveFilters
      const sourcePath = "cache-preset-test.md";
      const { services: s1, registerProcessor: rp1 } = createMockServices(createMockDataviewApi([]));
      registerPmTasksProcessor(s1, rp1);
      const el1 = document.createElement("div");
      const h1 = (rp1 as ReturnType<typeof createMockServices>["registerProcessor"]);
      // Retrieve the registered handler directly from the mock
      let handler1: ((source: string, el: HTMLElement, ctx: Record<string, unknown>) => void) | null = null;
      (rp1 as unknown as { mock: { calls: unknown[][] } }).mock.calls.forEach(([, fn]) => { handler1 = fn as typeof handler1; });
      handler1!(
        "mode: dashboard",
        el1,
        { addChild: () => {}, sourcePath } as unknown as Record<string, unknown>
      );

      // Click the first date preset button to populate the cache
      const presetBtn = el1.querySelector(".pm-date-preset-btn") as HTMLButtonElement | null;
      expect(presetBtn).not.toBeNull();
      presetBtn!.click();

      // Second render with the same sourcePath — cache should supply the saved filters
      const { services: s2, registerProcessor: rp2 } = createMockServices(createMockDataviewApi([]));
      registerPmTasksProcessor(s2, rp2);
      const el2 = document.createElement("div");
      let handler2: ((source: string, el: HTMLElement, ctx: Record<string, unknown>) => void) | null = null;
      (rp2 as unknown as { mock: { calls: unknown[][] } }).mock.calls.forEach(([, fn]) => { handler2 = fn as typeof handler2; });
      handler2!(
        "mode: dashboard",
        el2,
        { addChild: () => {}, sourcePath } as unknown as Record<string, unknown>
      );

      // The preset button in the second render should be marked active
      const presetBtn2 = el2.querySelector(".pm-date-preset-btn");
      expect(presetBtn2?.classList.contains("pm-date-preset-btn--active")).toBe(true);
    });

    it("clears cached state when null is passed (Clear Filters)", () => {
      const sourcePath = "cache-null-test.md";
      const { services: s1, registerProcessor: rp1 } = createMockServices(createMockDataviewApi([]));
      registerPmTasksProcessor(s1, rp1);
      const el1 = document.createElement("div");
      let handler1: ((source: string, el: HTMLElement, ctx: Record<string, unknown>) => void) | null = null;
      (rp1 as unknown as { mock: { calls: unknown[][] } }).mock.calls.forEach(([, fn]) => { handler1 = fn as typeof handler1; });
      handler1!(
        "mode: dashboard",
        el1,
        { addChild: () => {}, sourcePath } as unknown as Record<string, unknown>
      );

      // Populate the cache via a preset click, then clear it
      const presetBtn = el1.querySelector(".pm-date-preset-btn") as HTMLButtonElement | null;
      presetBtn!.click();
      const clearBtn = [...el1.querySelectorAll("button")].find(b => b.textContent === "Clear Filters") as HTMLButtonElement | undefined;
      expect(clearBtn).not.toBeUndefined();
      clearBtn!.click();

      // Second render — cache is empty; no preset should be active
      const { services: s2, registerProcessor: rp2 } = createMockServices(createMockDataviewApi([]));
      registerPmTasksProcessor(s2, rp2);
      const el2 = document.createElement("div");
      let handler2: ((source: string, el: HTMLElement, ctx: Record<string, unknown>) => void) | null = null;
      (rp2 as unknown as { mock: { calls: unknown[][] } }).mock.calls.forEach(([, fn]) => { handler2 = fn as typeof handler2; });
      handler2!(
        "mode: dashboard",
        el2,
        { addChild: () => {}, sourcePath } as unknown as Record<string, unknown>
      );

      const presetBtn2 = el2.querySelector(".pm-date-preset-btn");
      expect(presetBtn2?.classList.contains("pm-date-preset-btn--active")).toBe(false);
    });
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  describe("lifecycle", () => {
    it("onload registers vault modify event", () => {
      const { child, vaultOn } = render("mode: dashboard");
      // Manually trigger onload as Obsidian would via addChild
      (child as { onload(): void }).onload();
      expect(vaultOn).toHaveBeenCalledWith("modify", expect.any(Function));
    });

    it("onunload clears debounce timer without throwing", () => {
      const { child } = render("mode: dashboard");
      expect(() =>
        (child as { onunload(): void }).onunload()
      ).not.toThrow();
    });
  });
});
