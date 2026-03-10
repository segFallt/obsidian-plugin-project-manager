import { describe, it, expect, vi } from "vitest";
import { registerPmTasksProcessor } from "../../src/processors/pm-tasks-processor";
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
