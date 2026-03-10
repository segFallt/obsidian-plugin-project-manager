import { describe, it, expect, vi } from "vitest";
import { DateViewRenderer } from "../../../src/processors/dashboard-views/date-view-renderer";
import { createMockTask } from "../../mocks/dataview-mock";
import type { ITaskSortService } from "../../../src/services/interfaces";
import type { TaskListRenderer } from "../../../src/processors/task-list-renderer";
import type { DashboardFilters } from "../../../src/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return {
    viewMode: "date",
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
  const renderTaskList = vi.fn();
  const sortTasks = vi.fn((tasks) => tasks);
  const sortService = { sortTasks } as unknown as ITaskSortService;
  const renderer = { renderTaskList } as unknown as TaskListRenderer;
  return { dateRenderer: new DateViewRenderer(sortService, renderer), renderTaskList };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DateViewRenderer", () => {
  it("renders nothing when there are no tasks", () => {
    const { dateRenderer } = createRenderer();
    const el = document.createElement("div");
    dateRenderer.render(el, [], makeFilters());
    expect(el.innerHTML).toBe("");
  });

  it("renders 'No Due Date' section for tasks without due dates", () => {
    const { dateRenderer } = createRenderer();
    const el = document.createElement("div");
    dateRenderer.render(el, [createMockTask({ path: "projects/Alpha.md" })], makeFilters());
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain("📝 No Due Date");
  });

  it("renders 'Overdue' section for tasks past due", () => {
    const { dateRenderer } = createRenderer();
    const el = document.createElement("div");
    dateRenderer.render(
      el,
      [createMockTask({ path: "projects/Alpha.md", due: "2020-01-01" })],
      makeFilters()
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain("⚠️ Overdue");
  });

  it("renders 'Upcoming' section for tasks far in the future", () => {
    const { dateRenderer } = createRenderer();
    const el = document.createElement("div");
    dateRenderer.render(
      el,
      [createMockTask({ path: "projects/Alpha.md", due: "2099-12-31" })],
      makeFilters()
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain("🔮 Upcoming");
  });

  it("calls renderTaskList once per non-empty bucket", () => {
    const { dateRenderer, renderTaskList } = createRenderer();
    const el = document.createElement("div");
    dateRenderer.render(
      el,
      [
        createMockTask({ path: "p.md", due: "2020-01-01" }), // overdue
        createMockTask({ path: "p.md" }),                     // no due
      ],
      makeFilters()
    );
    expect(renderTaskList).toHaveBeenCalledTimes(2);
  });
});
