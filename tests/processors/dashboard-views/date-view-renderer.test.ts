import { describe, it, expect, vi } from "vitest";
import { DateViewRenderer, bucketTasksByDate } from "@/processors/dashboard-views/date-view-renderer";
import { createMockTask } from "../../mocks/dataview-mock";
import type { ITaskSortService } from "@/services/interfaces";
import type { TaskListRenderer } from "@/processors/task-list-renderer";
import type { DashboardFilters, DataviewTask } from "@/types";
import type { TaskRenderHelpers, ViewRenderContext } from "@/processors/view-renderer";
import {
  VIEW_MODE,
  GROUP_BY_DATE_FIELD,
  DATE_BUCKET_LABEL,
  START_BUCKET_LABEL,
  SCHEDULED_BUCKET_LABEL,
} from "@/constants";
import { addDays } from "@/utils/task-utils";
import { todayISO } from "@/utils/date-utils";
import { makeFilters as makeSharedFilters } from "../../helpers/dashboard-filters";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return makeSharedFilters({ viewMode: VIEW_MODE.DATE, showCompleted: false, ...overrides });
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

  // ─── Group-by-field (#99) ────────────────────────────────────────────────

  const headingsOf = (el: HTMLElement): (string | null)[] =>
    [...el.querySelectorAll("h2")].map((h) => h.textContent);

  it("defaults to grouping by due date when no group-by field is chosen", async () => {
    // A task with only a start date has no due date → it must fall in "No Due Date".
    const { dateRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await dateRenderer.render(
      makeCtx(el, [createMockTask({ path: "p.md", start: todayISO() })], makeFilters())
    );
    expect(headingsOf(el)).toContain(DATE_BUCKET_LABEL.NO_DUE_DATE);
  });

  it("groups by start date into start-date buckets", async () => {
    const { dateRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await dateRenderer.render(
      makeCtx(
        el,
        [
          createMockTask({ path: "p.md", start: "2020-01-01" }), // started (past)
          createMockTask({ path: "p.md", start: todayISO() }),   // starts today
          createMockTask({ path: "p.md", start: "2099-12-31" }), // starts later
        ],
        makeFilters({ groupByDateField: GROUP_BY_DATE_FIELD.START })
      )
    );
    const headings = headingsOf(el);
    expect(headings).toContain(START_BUCKET_LABEL.OVERDUE);
    expect(headings).toContain(START_BUCKET_LABEL.TODAY);
    expect(headings).toContain(START_BUCKET_LABEL.UPCOMING);
    // No due-date labels leak in when grouping by start.
    expect(headings).not.toContain(DATE_BUCKET_LABEL.OVERDUE);
  });

  it("groups by scheduled date into scheduled-date buckets", async () => {
    const { dateRenderer, makeCtx } = createRenderer();
    const el = document.createElement("div");
    await dateRenderer.render(
      makeCtx(
        el,
        [
          createMockTask({ path: "p.md", scheduled: "2020-01-01" }),
          createMockTask({ path: "p.md" }), // no scheduled date
        ],
        makeFilters({ groupByDateField: GROUP_BY_DATE_FIELD.SCHEDULED })
      )
    );
    const headings = headingsOf(el);
    expect(headings).toContain(SCHEDULED_BUCKET_LABEL.OVERDUE);
    expect(headings).toContain(SCHEDULED_BUCKET_LABEL.NO_DUE_DATE);
  });

  it("all fields share the same six boundaries (bucketTasksByDate parity)", () => {
    const today = todayISO();
    // One representative date per boundary.
    const dates = [
      "2020-01-01",        // < today        → OVERDUE
      today,               // == today       → TODAY
      addDays(today, 1),   // == today + 1   → TOMORROW
      addDays(today, 4),   // within a week  → THIS_WEEK
      addDays(today, 30),  // > today + 7    → UPCOMING
      undefined,           // no date        → NO_DUE_DATE
    ];
    const tasks = dates.map((d) => createMockTask({ path: "p.md", due: d, start: d, scheduled: d }));

    const byDue = bucketTasksByDate(tasks, (t) => t.due, DATE_BUCKET_LABEL);
    const byStart = bucketTasksByDate(tasks, (t) => t.start, START_BUCKET_LABEL);
    const byScheduled = bucketTasksByDate(tasks, (t) => t.scheduled, SCHEDULED_BUCKET_LABEL);

    // Exactly one task lands in each of the six buckets, identically across fields.
    const counts = (bs: ReturnType<typeof bucketTasksByDate>) => bs.map((b) => b.tasks.length);
    expect(counts(byDue)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(counts(byStart)).toEqual(counts(byDue));
    expect(counts(byScheduled)).toEqual(counts(byDue));
  });
});
