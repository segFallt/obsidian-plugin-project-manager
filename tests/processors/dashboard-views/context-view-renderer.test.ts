import { describe, it, expect, vi } from "vitest";
import { ContextViewRenderer } from "@/processors/dashboard-views/context-view-renderer";
import { createMockTask, createMockDataviewApi } from "../../mocks/dataview-mock";
import { DEFAULT_FOLDERS, CONTEXT, VIEW_MODE } from "@/constants";
import { getTaskContext, getParentProjectPath, getParentRecurringMeetingPath } from "@/utils/task-utils";
import { makeFilters as makeSharedFilters } from "../../helpers/dashboard-filters";
import type { ITaskSortService } from "@/services/interfaces";
import type { TaskListRenderer } from "@/processors/task-list-renderer";
import type { DashboardFilters, DataviewTask, DataviewApi } from "@/types";
import type { TaskRenderHelpers, ViewRenderContext } from "@/processors/view-renderer";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return makeSharedFilters({ viewMode: VIEW_MODE.CONTEXT, showCompleted: false, ...overrides });
}

function createRenderer() {
  const renderTaskList = vi.fn();
  const sortTasks = vi.fn((tasks) => tasks);
  const compareGroups = vi.fn(() => 0);

  const sortService = { sortTasks, compareGroups } as unknown as ITaskSortService;
  const taskRenderer = { renderTaskList } as unknown as TaskListRenderer;

  // Rebuilds the precomputed lookups the host (DashboardView) resolves up front,
  // using the same real utility functions and the test's mock Dataview API — so
  // the renderer sees identical inputs to production.
  const makeCtx = (
    container: HTMLElement,
    items: DataviewTask[],
    filters: DashboardFilters,
    dv: DataviewApi
  ): ViewRenderContext<DataviewTask> => {
    const folders = DEFAULT_FOLDERS;
    const contextMap = new Map(items.map((t) => [t.path, getTaskContext(t, folders)]));
    const parentPathMap = new Map<string, string | null>();
    for (const t of items) {
      const taskContext = contextMap.get(t.path);
      let parentPath: string | null = null;
      if (taskContext === CONTEXT.PROJECT) {
        parentPath = getParentProjectPath(t.link.path, dv, folders.projects);
      } else if (taskContext === CONTEXT.RECURRING_MEETING) {
        parentPath = getParentRecurringMeetingPath(t.link.path, dv, folders.meetingsRecurring);
      }
      parentPathMap.set(t.link.path, parentPath);
    }
    const namePaths = new Set<string>();
    for (const t of items) namePaths.add(t.link.path);
    for (const p of parentPathMap.values()) if (p) namePaths.add(p);
    const nameMap = new Map<string, string>();
    for (const p of namePaths) nameMap.set(p, dv.page(p)?.file.name ?? p);

    return {
      container,
      items,
      filters,
      onFilterChange: () => {},
      helpers: {
        sortService,
        taskRenderer,
        contextMap,
        mtimeMap: new Map(),
        parentPathMap,
        nameMap,
      } as TaskRenderHelpers,
    };
  };

  return {
    contextRenderer: new ContextViewRenderer(),
    renderTaskList,
    sortTasks,
    makeCtx,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ContextViewRenderer", () => {
  it("renders nothing when there are no tasks", async () => {
    const { contextRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    const dv = createMockDataviewApi([]);
    await contextRenderer.render(makeCtx(el, [], makeFilters(), dv));
    expect(el.innerHTML).toBe("");
  });

  it("creates an h2 heading for each non-empty context", async () => {
    const { contextRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    const tasks = [
      createMockTask({ path: "projects/Alpha.md" }),
      createMockTask({ path: "people/Alice.md" }),
    ];
    const dv = createMockDataviewApi([
      { path: "projects/Alpha.md" },
      { path: "people/Alice.md" },
    ]);
    await contextRenderer.render(makeCtx(el, tasks, makeFilters(), dv));
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain("Project");
    expect(headings).toContain("Person");
  });

  it("renders an h3 internal-link for each project file", async () => {
    const { contextRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    const tasks = [createMockTask({ path: "projects/Alpha.md" })];
    const dv = createMockDataviewApi([{ path: "projects/Alpha.md" }]);
    await contextRenderer.render(makeCtx(el, tasks, makeFilters(), dv));
    const link = el.querySelector("h3 a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("data-href")).toBe("projects/Alpha.md");
  });

  it("calls renderTaskList for each file group", async () => {
    const { contextRenderer, renderTaskList, makeCtx } = createRenderer();
    const el = document.createElement("div");
    const tasks = [
      createMockTask({ path: "projects/Alpha.md" }),
      createMockTask({ path: "projects/Beta.md" }),
    ];
    const dv = createMockDataviewApi([
      { path: "projects/Alpha.md" },
      { path: "projects/Beta.md" },
    ]);
    await contextRenderer.render(makeCtx(el, tasks, makeFilters(), dv));
    expect(renderTaskList).toHaveBeenCalledTimes(2);
  });

  it("nests project-note tasks under parent project with h4 heading", async () => {
    const { contextRenderer, renderTaskList, makeCtx } = createRenderer();
    const el = document.createElement("div");

    // Project-note task (relatedProject points to Alpha)
    const noteTask = createMockTask({ path: "projects/notes/AlphaNote.md" });

    const dv = createMockDataviewApi([
      { path: "projects/Alpha.md" },
      {
        path: "projects/notes/AlphaNote.md",
        frontmatter: { relatedProject: "[[Alpha]]" },
      },
    ]);

    await contextRenderer.render(makeCtx(el, [noteTask], makeFilters(), dv));

    const h4s = el.querySelectorAll("h4");
    expect(h4s.length).toBeGreaterThan(0);
    expect(renderTaskList).toHaveBeenCalled();
  });

  it("does not create h2 for contexts with no tasks", async () => {
    const { contextRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    const tasks = [createMockTask({ path: "projects/Alpha.md" })];
    const dv = createMockDataviewApi([{ path: "projects/Alpha.md" }]);
    await contextRenderer.render(makeCtx(el, tasks, makeFilters(), dv));

    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).not.toContain("Person");
    expect(headings).not.toContain("Meeting");
  });

  it("renders h2 'Recurring Meeting' (not 'Meeting') for tasks from meetings/recurring-events/", async () => {
    const { contextRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    const tasks = [
      createMockTask({ path: "meetings/recurring-events/StandUp/2024-01-15.md" }),
    ];
    const dv = createMockDataviewApi([
      { path: "meetings/recurring-events/StandUp/2024-01-15.md" },
    ]);
    await contextRenderer.render(makeCtx(el, tasks, makeFilters(), dv));
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain("Recurring Meeting");
    expect(headings).not.toContain("Meeting");
  });

  it("nests recurring meeting event tasks under parent recurring meeting with h3 and h4", async () => {
    const { contextRenderer, renderTaskList, makeCtx } = createRenderer();
    const el = document.createElement("div");

    const eventTask = createMockTask({
      path: "meetings/recurring-events/StandUp/2024-01-15.md",
    });

    const dv = createMockDataviewApi([
      { path: "meetings/recurring/StandUp.md" },
      {
        path: "meetings/recurring-events/StandUp/2024-01-15.md",
        frontmatter: { "recurring-meeting": "[[StandUp]]" },
      },
    ]);

    await contextRenderer.render(makeCtx(el, [eventTask], makeFilters(), dv));

    const h3s = el.querySelectorAll("h3");
    const h4s = el.querySelectorAll("h4");
    expect(h3s.length).toBe(1);
    expect(h3s[0].querySelector("a")?.getAttribute("data-href")).toBe("meetings/recurring/StandUp.md");
    expect(h4s.length).toBe(1);
    expect(h4s[0].querySelector("a")?.getAttribute("data-href")).toBe(
      "meetings/recurring-events/StandUp/2024-01-15.md"
    );
    expect(renderTaskList).toHaveBeenCalledTimes(1);
  });

  it("renders one h3 with multiple h4s when multiple events share the same parent recurring meeting", async () => {
    const { contextRenderer, renderTaskList, makeCtx } = createRenderer();
    const el = document.createElement("div");

    const event1Task = createMockTask({
      path: "meetings/recurring-events/StandUp/2024-01-15.md",
    });
    const event2Task = createMockTask({
      path: "meetings/recurring-events/StandUp/2024-01-22.md",
    });

    const dv = createMockDataviewApi([
      { path: "meetings/recurring/StandUp.md" },
      {
        path: "meetings/recurring-events/StandUp/2024-01-15.md",
        frontmatter: { "recurring-meeting": "[[StandUp]]" },
      },
      {
        path: "meetings/recurring-events/StandUp/2024-01-22.md",
        frontmatter: { "recurring-meeting": "[[StandUp]]" },
      },
    ]);

    await contextRenderer.render(makeCtx(el, [event1Task, event2Task], makeFilters(), dv));

    const h3s = el.querySelectorAll("h3");
    const h4s = el.querySelectorAll("h4");
    expect(h3s.length).toBe(1);
    expect(h4s.length).toBe(2);
    expect(renderTaskList).toHaveBeenCalledTimes(2);
  });

  it("renders flat output (no h4) for orphan recurring meeting event with no recurring-meeting frontmatter", async () => {
    const { contextRenderer, renderTaskList, makeCtx } = createRenderer();
    const el = document.createElement("div");

    const orphanTask = createMockTask({
      path: "meetings/recurring-events/StandUp/2024-01-15.md",
    });

    const dv = createMockDataviewApi([
      { path: "meetings/recurring-events/StandUp/2024-01-15.md" },
    ]);

    await contextRenderer.render(makeCtx(el, [orphanTask], makeFilters(), dv));

    const h4s = el.querySelectorAll("h4");
    expect(h4s.length).toBe(0);
    expect(renderTaskList).toHaveBeenCalledTimes(1);
  });
});
