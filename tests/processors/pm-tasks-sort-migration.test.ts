import { describe, it, expect } from "vitest";
import { resolveSortBy } from "@/processors/pm-tasks-dashboard";
import { TaskSortService } from "@/services/task-sort-service";
import { SORT_FIELD, SORT_DIRECTION } from "@/constants";
import { createMockTask } from "../mocks/dataview-mock";
import type { SortKey } from "@/types";

// ─── resolveSortBy ──────────────────────────────────────────────────

describe("resolveSortBy", () => {
  it("maps each legacy sortBy string to the current SortKey[] via the constants", () => {
    expect(resolveSortBy("dueDate-asc")).toEqual([
      { field: SORT_FIELD.DUE_DATE, direction: SORT_DIRECTION.ASC },
    ]);
    expect(resolveSortBy("dueDate-desc")).toEqual([
      { field: SORT_FIELD.DUE_DATE, direction: SORT_DIRECTION.DESC },
    ]);
    expect(resolveSortBy("priority-asc")).toEqual([
      { field: SORT_FIELD.PRIORITY, direction: SORT_DIRECTION.ASC },
    ]);
    expect(resolveSortBy("priority-desc")).toEqual([
      { field: SORT_FIELD.PRIORITY, direction: SORT_DIRECTION.DESC },
    ]);
  });

  it("maps the start/scheduled string shorthands to their SortKey[]", () => {
    expect(resolveSortBy("startDate-asc")).toEqual([
      { field: SORT_FIELD.START_DATE, direction: SORT_DIRECTION.ASC },
    ]);
    expect(resolveSortBy("startDate-desc")).toEqual([
      { field: SORT_FIELD.START_DATE, direction: SORT_DIRECTION.DESC },
    ]);
    expect(resolveSortBy("scheduledDate-asc")).toEqual([
      { field: SORT_FIELD.SCHEDULED_DATE, direction: SORT_DIRECTION.ASC },
    ]);
    expect(resolveSortBy("scheduledDate-desc")).toEqual([
      { field: SORT_FIELD.SCHEDULED_DATE, direction: SORT_DIRECTION.DESC },
    ]);
  });

  it("keeps the legacy key strings byte-identical to the persisted values", () => {
    // A saved value written before the refactor must still resolve.
    expect(resolveSortBy("dueDate-asc")).toHaveLength(1);
    expect(resolveSortBy("unknown-key")).toEqual([]);
  });

  it("passes a saved SortKey[] through unchanged", () => {
    const saved: SortKey[] = [
      { field: SORT_FIELD.PRIORITY, direction: SORT_DIRECTION.DESC },
      { field: SORT_FIELD.ALPHABETICAL, direction: SORT_DIRECTION.ASC },
    ];
    expect(resolveSortBy(saved)).toEqual(saved);
  });

  it("returns an empty array for absent or non-string/array input", () => {
    expect(resolveSortBy(undefined)).toEqual([]);
    expect(resolveSortBy(null)).toEqual([]);
    expect(resolveSortBy(42)).toEqual([]);
  });
});

// ─── saved-filter sort path applies unchanged ──────────────────────────────

describe("saved filters load and sort unchanged", () => {
  it("applies a migrated legacy key identically to the explicit SortKey", () => {
    const tasks = [
      createMockTask({ path: "a.md", text: "A", due: "2024-03-01" }),
      createMockTask({ path: "b.md", text: "B", due: "2024-01-01" }),
      createMockTask({ path: "c.md", text: "C", due: "2024-02-01" }),
    ];
    const service = new TaskSortService();

    const viaLegacy = service.sortTasks(tasks, resolveSortBy("dueDate-asc"));
    const viaExplicit = service.sortTasks(tasks, [
      { field: SORT_FIELD.DUE_DATE, direction: SORT_DIRECTION.ASC },
    ]);

    expect(viaLegacy.map((t) => t.path)).toEqual(["b.md", "c.md", "a.md"]);
    expect(viaLegacy.map((t) => t.path)).toEqual(viaExplicit.map((t) => t.path));
  });
});
