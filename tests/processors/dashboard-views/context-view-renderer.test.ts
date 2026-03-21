import { describe, it, expect, vi } from "vitest";
import { ContextViewRenderer } from "../../../src/processors/dashboard-views/context-view-renderer";
import { createMockTask, createMockDataviewApi } from "../../mocks/dataview-mock";
import { DEFAULT_FOLDERS, DEFAULT_DUE_DATE_FILTER } from "../../../src/constants";
import type { TaskProcessorServices } from "../../../src/plugin-context";
import type { ITaskSortService } from "../../../src/services/interfaces";
import type { TaskListRenderer } from "../../../src/processors/task-list-renderer";
import type { DashboardFilters } from "../../../src/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return {
    viewMode: "context",
    sortBy: [],
    showCompleted: false,
    contextFilter: [],
    dueDateFilter: DEFAULT_DUE_DATE_FILTER,
    priorityFilter: [],
    projectStatusFilter: [],
    inboxStatusFilter: "All",
    meetingDateFilter: "All",
    clientFilter: [],
    engagementFilter: [],
    includeUnassignedClients: false,
    includeUnassignedEngagements: false,
    tagFilter: [],
    includeUntagged: false,
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
  it("renders nothing when there are no tasks", async () => {
    const { contextRenderer } = createRenderer();
    const el = document.createElement("div");
    const dv = createMockDataviewApi([]);
    await contextRenderer.render(el, [], makeFilters(), dv);
    expect(el.innerHTML).toBe("");
  });

  it("creates an h2 heading for each non-empty context", async () => {
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
    await contextRenderer.render(el, tasks, makeFilters(), dv);
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain("Project");
    expect(headings).toContain("Person");
  });

  it("renders an h3 internal-link for each project file", async () => {
    const { contextRenderer } = createRenderer();
    const el = document.createElement("div");
    const tasks = [createMockTask({ path: "projects/Alpha.md" })];
    const dv = createMockDataviewApi([{ path: "projects/Alpha.md" }]);
    await contextRenderer.render(el, tasks, makeFilters(), dv);
    const link = el.querySelector("h3 a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("data-href")).toBe("projects/Alpha.md");
  });

  it("calls renderTaskList for each file group", async () => {
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
    await contextRenderer.render(el, tasks, makeFilters(), dv);
    expect(renderTaskList).toHaveBeenCalledTimes(2);
  });

  it("nests project-note tasks under parent project with h4 heading", async () => {
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

    await contextRenderer.render(el, [noteTask], makeFilters(), dv);

    const h4s = el.querySelectorAll("h4");
    expect(h4s.length).toBeGreaterThan(0);
    expect(renderTaskList).toHaveBeenCalled();
  });

  it("does not create h2 for contexts with no tasks", async () => {
    const { contextRenderer } = createRenderer();
    const el = document.createElement("div");
    const tasks = [createMockTask({ path: "projects/Alpha.md" })];
    const dv = createMockDataviewApi([{ path: "projects/Alpha.md" }]);
    await contextRenderer.render(el, tasks, makeFilters(), dv);

    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).not.toContain("Person");
    expect(headings).not.toContain("Meeting");
  });

  it("renders h2 'Recurring Meeting' (not 'Meeting') for tasks from meetings/recurring-events/", async () => {
    const { contextRenderer } = createRenderer();
    const el = document.createElement("div");
    const tasks = [
      createMockTask({ path: "meetings/recurring-events/StandUp/2024-01-15.md" }),
    ];
    const dv = createMockDataviewApi([
      { path: "meetings/recurring-events/StandUp/2024-01-15.md" },
    ]);
    await contextRenderer.render(el, tasks, makeFilters(), dv);
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain("Recurring Meeting");
    expect(headings).not.toContain("Meeting");
  });

  it("nests recurring meeting event tasks under parent recurring meeting with h3 and h4", async () => {
    const { contextRenderer, renderTaskList } = createRenderer();
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

    await contextRenderer.render(el, [eventTask], makeFilters(), dv);

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
    const { contextRenderer, renderTaskList } = createRenderer();
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

    await contextRenderer.render(el, [event1Task, event2Task], makeFilters(), dv);

    const h3s = el.querySelectorAll("h3");
    const h4s = el.querySelectorAll("h4");
    expect(h3s.length).toBe(1);
    expect(h4s.length).toBe(2);
    expect(renderTaskList).toHaveBeenCalledTimes(2);
  });

  it("renders flat output (no h4) for orphan recurring meeting event with no recurring-meeting frontmatter", async () => {
    const { contextRenderer, renderTaskList } = createRenderer();
    const el = document.createElement("div");

    const orphanTask = createMockTask({
      path: "meetings/recurring-events/StandUp/2024-01-15.md",
    });

    const dv = createMockDataviewApi([
      { path: "meetings/recurring-events/StandUp/2024-01-15.md" },
    ]);

    await contextRenderer.render(el, [orphanTask], makeFilters(), dv);

    const h4s = el.querySelectorAll("h4");
    expect(h4s.length).toBe(0);
    expect(renderTaskList).toHaveBeenCalledTimes(1);
  });
});
