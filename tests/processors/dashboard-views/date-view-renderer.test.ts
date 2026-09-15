import { describe, it, expect, vi } from "vitest";
import { DateViewRenderer } from "../../../src/processors/dashboard-views/date-view-renderer";
import { createMockTask } from "../../mocks/dataview-mock";
import type { ITaskSortService } from "../../../src/services/interfaces";
import type { TaskListRenderer } from "../../../src/processors/task-list-renderer";
import type { DashboardFilters, DataviewTask } from "../../../src/types";
import type { TaskRenderHelpers, ViewRenderContext } from "../../../src/processors/view-renderer";
import { DEFAULT_DUE_DATE_FILTER } from "../../../src/constants";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return {
    viewMode: "date",
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
  const renderTaskList = vi.fn();
  const sortTasks = vi.fn((tasks) => tasks);
  const sortService = { sortTasks } as unknown as ITaskSortService;
  const taskRenderer = { renderTaskList } as unknown as TaskListRenderer;

  const makeCtx = (
    container: HTMLElement,
    items: DataviewTask[],
    filters: DashboardFilters
  ): ViewRenderContext<DataviewTask> => ({
    container,
    items,
    filters,
    onFilterChange: () => {},
    helpers: {
      sortService,
      taskRenderer,
      contextMap: new Map(),
      mtimeMap: new Map(),
      parentPathMap: new Map(),
      nameMap: new Map(),
    } as TaskRenderHelpers,
  });

  return { dateRenderer: new DateViewRenderer(), renderTaskList, makeCtx };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DateViewRenderer", () => {
  it("renders nothing when there are no tasks", async () => {
    const { dateRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await dateRenderer.render(makeCtx(el, [], makeFilters()));
    expect(el.innerHTML).toBe("");
  });

  it("renders 'No Due Date' section for tasks without due dates", async () => {
    const { dateRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await dateRenderer.render(makeCtx(el, [createMockTask({ path: "projects/Alpha.md" })], makeFilters()));
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain("📝 No Due Date");
  });

  it("renders 'Overdue' section for tasks past due", async () => {
    const { dateRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await dateRenderer.render(
      makeCtx(el, [createMockTask({ path: "projects/Alpha.md", due: "2020-01-01" })], makeFilters())
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain("⚠️ Overdue");
  });

  it("renders 'Upcoming' section for tasks far in the future", async () => {
    const { dateRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await dateRenderer.render(
      makeCtx(el, [createMockTask({ path: "projects/Alpha.md", due: "2099-12-31" })], makeFilters())
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain("🔮 Upcoming");
  });

  it("calls renderTaskList once per non-empty bucket", async () => {
    const { dateRenderer, renderTaskList, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await dateRenderer.render(
      makeCtx(
        el,
        [
          createMockTask({ path: "p.md", due: "2020-01-01" }), // overdue
          createMockTask({ path: "p.md" }),                     // no due
        ],
        makeFilters()
      )
    );
    expect(renderTaskList).toHaveBeenCalledTimes(2);
  });
});
