import { describe, it, expect, vi } from "vitest";
import { TagViewRenderer } from "@/processors/dashboard-views/tag-view-renderer";
import { createMockTask } from "../../mocks/dataview-mock";
import type { ITaskSortService } from "@/services/interfaces";
import type { TaskListRenderer } from "@/processors/task-list-renderer";
import type { DashboardFilters, DataviewTask } from "@/types";
import type { TaskRenderHelpers, ViewRenderContext } from "@/processors/view-renderer";
import { VIEW_MODE } from "@/constants";
import { makeFilters as makeSharedFilters } from "../../helpers/dashboard-filters";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return makeSharedFilters({ viewMode: VIEW_MODE.TAG, showCompleted: false, ...overrides });
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

  return { tagRenderer: new TagViewRenderer(), renderTaskList, makeCtx };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TagViewRenderer", () => {
  it("renders nothing when there are no tasks", async () => {
    const { tagRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await tagRenderer.render(makeCtx(el, [], makeFilters()));
    expect(el.innerHTML).toBe("");
  });

  it("renders 'Untagged' section for tasks with no tags", async () => {
    const { tagRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await tagRenderer.render(
      makeCtx(el, [createMockTask({ path: "p.md", tags: [] })], makeFilters())
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toContain("📌 Untagged");
  });

  it("renders a section per unique tag (sorted alphabetically)", async () => {
    const { tagRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await tagRenderer.render(
      makeCtx(
        el,
        [
          createMockTask({ path: "p.md", tags: ["#work"] }),
          createMockTask({ path: "p.md", tags: ["#home"] }),
        ],
        makeFilters()
      )
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings).toEqual(["#home", "#work"]);
  });

  it("places Untagged after all tag sections", async () => {
    const { tagRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await tagRenderer.render(
      makeCtx(
        el,
        [
          createMockTask({ path: "p.md", tags: ["#work"] }),
          createMockTask({ path: "p.md", tags: [] }),
        ],
        makeFilters()
      )
    );
    const headings = [...el.querySelectorAll("h2")].map((h) => h.textContent);
    expect(headings[headings.length - 1]).toBe("📌 Untagged");
  });

  it("calls renderTaskList once per non-empty section", async () => {
    const { tagRenderer, renderTaskList, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await tagRenderer.render(
      makeCtx(
        el,
        [
          createMockTask({ path: "p.md", tags: ["#work"] }),
          createMockTask({ path: "p.md", tags: [] }),
        ],
        makeFilters()
      )
    );
    expect(renderTaskList).toHaveBeenCalledTimes(2);
  });

  it("groups tasks sharing the same tag into one section", async () => {
    const { tagRenderer, renderTaskList, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await tagRenderer.render(
      makeCtx(
        el,
        [
          createMockTask({ path: "p.md", tags: ["#work"] }),
          createMockTask({ path: "p.md", tags: ["#work"] }),
        ],
        makeFilters()
      )
    );
    expect(renderTaskList).toHaveBeenCalledTimes(1);
    const [, tasks] = renderTaskList.mock.calls[0] as [HTMLElement, unknown[]];
    expect(tasks).toHaveLength(2);
  });
});
