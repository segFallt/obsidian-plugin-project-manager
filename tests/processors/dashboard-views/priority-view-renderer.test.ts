import { describe, it, expect, vi } from "vitest";
import { PriorityViewRenderer } from "@/processors/dashboard-views/priority-view-renderer";
import { createMockTask } from "../../mocks/dataview-mock";
import { PRIORITY_DISPLAY, VIEW_MODE } from "@/constants";
import { makeFilters as makeSharedFilters } from "../../helpers/dashboard-filters";
import type { ITaskSortService } from "@/services/interfaces";
import type { TaskListRenderer } from "@/processors/task-list-renderer";
import type { DashboardFilters, DataviewTask } from "@/types";
import type { TaskRenderHelpers, ViewRenderContext } from "@/processors/view-renderer";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return makeSharedFilters({ viewMode: VIEW_MODE.PRIORITY, showCompleted: false, ...overrides });
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

  return { priorityRenderer: new PriorityViewRenderer(), renderTaskList, makeCtx };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PriorityViewRenderer", () => {
  it("renders nothing when there are no tasks", async () => {
    const { priorityRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await priorityRenderer.render(makeCtx(el, [], makeFilters()));
    expect(el.innerHTML).toBe("");
  });

  it("renders h2 with correct priority display label for urgent task (⏫)", async () => {
    const { priorityRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await priorityRenderer.render(
      makeCtx(el, [createMockTask({ path: "p.md", text: "Urgent task ⏫" })], makeFilters())
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain(PRIORITY_DISPLAY[1]);
  });

  it("renders h2 for medium priority by default (no emoji = priority 3)", async () => {
    const { priorityRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await priorityRenderer.render(
      makeCtx(el, [createMockTask({ path: "p.md", text: "No priority emoji" })], makeFilters())
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain(PRIORITY_DISPLAY[3]);
  });

  it("renders one section per distinct priority level present", async () => {
    const { priorityRenderer, renderTaskList, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await priorityRenderer.render(
      makeCtx(
        el,
        [
          createMockTask({ path: "p.md", text: "Urgent ⏫" }),
          createMockTask({ path: "p.md", text: "Normal" }), // default medium
        ],
        makeFilters()
      )
    );
    expect(renderTaskList).toHaveBeenCalledTimes(2);
  });

  it("does not render sections for priority levels with no tasks", async () => {
    const { priorityRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await priorityRenderer.render(
      makeCtx(el, [createMockTask({ path: "p.md", text: "Urgent ⏫" })], makeFilters())
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    // Only 4 priorities exist now (1-4); low priority (4) should not render if no low-priority tasks
    expect(headings).not.toContain(PRIORITY_DISPLAY[4]);
  });
});
