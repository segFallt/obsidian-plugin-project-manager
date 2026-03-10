import { describe, it, expect, vi } from "vitest";
import { PriorityViewRenderer } from "../../../src/processors/dashboard-views/priority-view-renderer";
import { createMockTask } from "../../mocks/dataview-mock";
import { PRIORITY_DISPLAY } from "../../../src/constants";
import type { ITaskSortService } from "../../../src/services/interfaces";
import type { TaskListRenderer } from "../../../src/processors/task-list-renderer";
import type { DashboardFilters } from "../../../src/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return {
    viewMode: "priority",
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
  return { priorityRenderer: new PriorityViewRenderer(sortService, renderer), renderTaskList };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PriorityViewRenderer", () => {
  it("renders nothing when there are no tasks", () => {
    const { priorityRenderer } = createRenderer();
    const el = document.createElement("div");
    priorityRenderer.render(el, [], makeFilters());
    expect(el.innerHTML).toBe("");
  });

  it("renders h2 with correct priority display label for urgent task (⏫)", () => {
    const { priorityRenderer } = createRenderer();
    const el = document.createElement("div");
    priorityRenderer.render(
      el,
      [createMockTask({ path: "p.md", text: "Urgent task ⏫" })],
      makeFilters()
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain(PRIORITY_DISPLAY[1]);
  });

  it("renders h2 for medium priority by default (no emoji = priority 3)", () => {
    const { priorityRenderer } = createRenderer();
    const el = document.createElement("div");
    priorityRenderer.render(
      el,
      [createMockTask({ path: "p.md", text: "No priority emoji" })],
      makeFilters()
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain(PRIORITY_DISPLAY[3]);
  });

  it("renders one section per distinct priority level present", () => {
    const { priorityRenderer, renderTaskList } = createRenderer();
    const el = document.createElement("div");
    priorityRenderer.render(
      el,
      [
        createMockTask({ path: "p.md", text: "Urgent ⏫" }),
        createMockTask({ path: "p.md", text: "Normal" }), // default medium
      ],
      makeFilters()
    );
    expect(renderTaskList).toHaveBeenCalledTimes(2);
  });

  it("does not render sections for priority levels with no tasks", () => {
    const { priorityRenderer } = createRenderer();
    const el = document.createElement("div");
    priorityRenderer.render(
      el,
      [createMockTask({ path: "p.md", text: "Urgent ⏫" })],
      makeFilters()
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).not.toContain(PRIORITY_DISPLAY[5]);
  });
});
