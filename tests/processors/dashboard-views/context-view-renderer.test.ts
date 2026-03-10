import { describe, it, expect, vi } from "vitest";
import { ContextViewRenderer } from "../../../src/processors/dashboard-views/context-view-renderer";
import { createMockTask, createMockDataviewApi } from "../../mocks/dataview-mock";
import { DEFAULT_FOLDERS } from "../../../src/constants";
import type { TaskProcessorServices } from "../../../src/plugin-context";
import type { ITaskSortService } from "../../../src/services/interfaces";
import type { TaskListRenderer } from "../../../src/processors/task-list-renderer";
import type { DashboardFilters } from "../../../src/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return {
    viewMode: "context",
    sortBy: "none",
    showCompleted: false,
    contextFilter: [],
    dueDateFilter: "All",
    priorityFilter: [],
    projectStatusFilter: [],
    inboxStatusFilter: "All",
    meetingDateFilter: "All",
    clientFilter: [],
    engagementFilter: [],
    includeUnassignedClients: false,
    includeUnassignedEngagements: false,
    searchText: "",
    ...overrides,
  };
}

function createRenderer() {
  const services = {
    settings: { folders: DEFAULT_FOLDERS },
  } as unknown as TaskProcessorServices;

  const renderTaskList = vi.fn();
  const sortTasks = vi.fn((tasks) => tasks);
  const compareGroups = vi.fn(() => 0);

  const sortService = { sortTasks, compareGroups } as unknown as ITaskSortService;
  const renderer = { renderTaskList } as unknown as TaskListRenderer;

  return {
    contextRenderer: new ContextViewRenderer(services, sortService, renderer),
    renderTaskList,
    sortTasks,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ContextViewRenderer", () => {
  it("renders nothing when there are no tasks", () => {
    const { contextRenderer } = createRenderer();
    const el = document.createElement("div");
    const dv = createMockDataviewApi([]);
    contextRenderer.render(el, [], makeFilters(), dv);
    expect(el.innerHTML).toBe("");
  });

  it("creates an h2 heading for each non-empty context", () => {
    const { contextRenderer } = createRenderer();
    const el = document.createElement("div");
    const tasks = [
      createMockTask({ path: "projects/Alpha.md" }),
      createMockTask({ path: "people/Alice.md" }),
    ];
    const dv = createMockDataviewApi([
      { path: "projects/Alpha.md" },
      { path: "people/Alice.md" },
    ]);
    contextRenderer.render(el, tasks, makeFilters(), dv);
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain("Project");
    expect(headings).toContain("Person");
  });

  it("renders an h3 internal-link for each project file", () => {
    const { contextRenderer } = createRenderer();
    const el = document.createElement("div");
    const tasks = [createMockTask({ path: "projects/Alpha.md" })];
    const dv = createMockDataviewApi([{ path: "projects/Alpha.md" }]);
    contextRenderer.render(el, tasks, makeFilters(), dv);
    const link = el.querySelector("h3 a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("data-href")).toBe("projects/Alpha.md");
  });

  it("calls renderTaskList for each file group", () => {
    const { contextRenderer, renderTaskList } = createRenderer();
    const el = document.createElement("div");
    const tasks = [
      createMockTask({ path: "projects/Alpha.md" }),
      createMockTask({ path: "projects/Beta.md" }),
    ];
    const dv = createMockDataviewApi([
      { path: "projects/Alpha.md" },
      { path: "projects/Beta.md" },
    ]);
    contextRenderer.render(el, tasks, makeFilters(), dv);
    expect(renderTaskList).toHaveBeenCalledTimes(2);
  });

  it("nests project-note tasks under parent project with h4 heading", () => {
    const { contextRenderer, renderTaskList } = createRenderer();
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

    contextRenderer.render(el, [noteTask], makeFilters(), dv);

    const h4s = el.querySelectorAll("h4");
    expect(h4s.length).toBeGreaterThan(0);
    expect(renderTaskList).toHaveBeenCalled();
  });

  it("does not create h2 for contexts with no tasks", () => {
    const { contextRenderer } = createRenderer();
    const el = document.createElement("div");
    const tasks = [createMockTask({ path: "projects/Alpha.md" })];
    const dv = createMockDataviewApi([{ path: "projects/Alpha.md" }]);
    contextRenderer.render(el, tasks, makeFilters(), dv);

    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).not.toContain("Person");
    expect(headings).not.toContain("Meeting");
  });
});
