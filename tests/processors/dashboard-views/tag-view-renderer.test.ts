import { describe, it, expect, vi } from "vitest";
import { TagViewRenderer } from "../../../src/processors/dashboard-views/tag-view-renderer";
import { createMockTask } from "../../mocks/dataview-mock";
import type { ITaskSortService } from "../../../src/services/interfaces";
import type { TaskListRenderer } from "../../../src/processors/task-list-renderer";
import type { DashboardFilters } from "../../../src/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return {
    viewMode: "tag",
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
  return { tagRenderer: new TagViewRenderer(sortService, renderer), renderTaskList };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TagViewRenderer", () => {
  it("renders nothing when there are no tasks", async () => {
    const { tagRenderer } = createRenderer();
    const el = document.createElement("div");
    await tagRenderer.render(el, [], makeFilters());
    expect(el.innerHTML).toBe("");
  });

  it("renders 'Untagged' section for tasks with no tags", async () => {
    const { tagRenderer } = createRenderer();
    const el = document.createElement("div");
    await tagRenderer.render(
      el,
      [createMockTask({ path: "p.md", tags: [] })],
      makeFilters()
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain("📌 Untagged");
  });

  it("renders a section per unique tag (sorted alphabetically)", async () => {
    const { tagRenderer } = createRenderer();
    const el = document.createElement("div");
    await tagRenderer.render(
      el,
      [
        createMockTask({ path: "p.md", tags: ["#work"] }),
        createMockTask({ path: "p.md", tags: ["#home"] }),
      ],
      makeFilters()
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toEqual(["#home", "#work"]);
  });

  it("places Untagged after all tag sections", async () => {
    const { tagRenderer } = createRenderer();
    const el = document.createElement("div");
    await tagRenderer.render(
      el,
      [
        createMockTask({ path: "p.md", tags: ["#work"] }),
        createMockTask({ path: "p.md", tags: [] }),
      ],
      makeFilters()
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings[headings.length - 1]).toBe("📌 Untagged");
  });

  it("calls renderTaskList once per non-empty section", async () => {
    const { tagRenderer, renderTaskList } = createRenderer();
    const el = document.createElement("div");
    await tagRenderer.render(
      el,
      [
        createMockTask({ path: "p.md", tags: ["#work"] }),
        createMockTask({ path: "p.md", tags: [] }),
      ],
      makeFilters()
    );
    expect(renderTaskList).toHaveBeenCalledTimes(2);
  });

  it("groups tasks sharing the same tag into one section", async () => {
    const { tagRenderer, renderTaskList } = createRenderer();
    const el = document.createElement("div");
    await tagRenderer.render(
      el,
      [
        createMockTask({ path: "p.md", tags: ["#work"] }),
        createMockTask({ path: "p.md", tags: ["#work"] }),
      ],
      makeFilters()
    );
    expect(renderTaskList).toHaveBeenCalledTimes(1);
    const [, tasks] = renderTaskList.mock.calls[0] as [HTMLElement, unknown[]];
    expect(tasks).toHaveLength(2);
  });
});
