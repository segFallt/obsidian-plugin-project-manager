import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskFilterService } from "@/services/task-filter-service";
import { createMockTask, createMockDataviewApi, createMockPage } from "../mocks/dataview-mock";
import type { DashboardFilters, DueDateFilter } from "@/types";
import { DEFAULT_FOLDERS, DEFAULT_DUE_DATE_FILTER } from "@/constants";
import type { FolderSettings } from "@/settings";

const defaultFolders = DEFAULT_FOLDERS as unknown as FolderSettings;

// ─── Test helpers ─────────────────────────────────────────────────────────

/** Default DueDateFilter that shows all tasks (no presets, no range). */
const ALL_DUE_DATE_FILTER: DueDateFilter = { selectedPresets: [], rangeFrom: null, rangeTo: null };

function makeFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return {
    viewMode: "context",
    sortBy: [],
    showCompleted: true,
    contextFilter: [],
    dueDateFilter: ALL_DUE_DATE_FILTER,
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

// Minimal IEntityHierarchyService mock
function makeHierarchyService(overrides: Partial<{
  resolveClientName: (page: import("@/types").DataviewPage) => string | null;
  resolveEngagementName: (page: import("@/types").DataviewPage) => string | null;
}> = {}) {
  return {
    resolveClientName: overrides.resolveClientName ?? (() => null),
    resolveEngagementName: overrides.resolveEngagementName ?? (() => null),
  } as unknown as import("@/services/interfaces").IEntityHierarchyService;
}

const service = new TaskFilterService(defaultFolders);

// ─── applyDashboardFilters ────────────────────────────────────────────────

describe("TaskFilterService.applyDashboardFilters", () => {
  it("returns all tasks when filters are in default state", () => {
    const dv = createMockDataviewApi([
      { path: "inbox/Task.md" },
    ]);
    const tasks = [
      createMockTask({ path: "inbox/Task.md", text: "Task 1", completed: false }),
      createMockTask({ path: "inbox/Task.md", text: "Task 2", completed: true }),
    ];
    const result = service.applyDashboardFilters(tasks, makeFilters(), dv, makeHierarchyService());
    expect(result).toHaveLength(2);
  });

  it("filters out completed tasks when showCompleted is false", () => {
    const dv = createMockDataviewApi([]);
    const tasks = [
      createMockTask({ path: "inbox/t.md", completed: false }),
      createMockTask({ path: "inbox/t.md", completed: true }),
    ];
    const result = service.applyDashboardFilters(
      tasks,
      makeFilters({ showCompleted: false }),
      dv,
      makeHierarchyService()
    );
    expect(result).toHaveLength(1);
    expect(result[0].completed).toBe(false);
  });

  it("filters by context", () => {
    const dv = createMockDataviewApi([]);
    const tasks = [
      createMockTask({ path: "inbox/t.md", text: "inbox" }),
      createMockTask({ path: "projects/p.md", text: "project" }),
    ];
    const result = service.applyDashboardFilters(
      tasks,
      makeFilters({ contextFilter: ["Inbox"] }),
      dv,
      makeHierarchyService()
    );
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("inbox/t.md");
  });

  it("filters by search text (case-insensitive)", () => {
    const dv = createMockDataviewApi([]);
    const tasks = [
      createMockTask({ path: "inbox/t.md", text: "Buy groceries" }),
      createMockTask({ path: "inbox/t.md", text: "Write report" }),
    ];
    const result = service.applyDashboardFilters(
      tasks,
      makeFilters({ searchText: "groceries" }),
      dv,
      makeHierarchyService()
    );
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Buy groceries");
  });

  it("filters by due date (Today preset)", () => {
    const dv = createMockDataviewApi([]);
    const today = new Date().toISOString().split("T")[0];
    const tasks = [
      createMockTask({ path: "inbox/t.md", due: today }),
      createMockTask({ path: "inbox/t.md" }), // no due date
    ];
    const result = service.applyDashboardFilters(
      tasks,
      makeFilters({ dueDateFilter: { selectedPresets: ["Today"], rangeFrom: null, rangeTo: null } }),
      dv,
      makeHierarchyService()
    );
    expect(result).toHaveLength(1);
    expect(result[0].due).toBe(today);
  });

  it("filters by priority", () => {
    const dv = createMockDataviewApi([]);
    const tasks = [
      createMockTask({ path: "inbox/t.md", text: "Urgent ⏫" }),
      createMockTask({ path: "inbox/t.md", text: "Low ⏬" }),
      createMockTask({ path: "inbox/t.md", text: "Medium task" }),
    ];
    const result = service.applyDashboardFilters(
      tasks,
      makeFilters({ priorityFilter: [1] }),
      dv,
      makeHierarchyService()
    );
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Urgent ⏫");
  });
});

// ─── matchesDueDateFilter ─────────────────────────────────────────────────

/** Helper: offset today by N days, returns ISO string */
function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

describe("TaskFilterService.matchesDueDateFilter — inactive filter", () => {
  it("filter not active (no presets, all null) — shows all tasks", () => {
    const task = createMockTask({ path: "t.md" });
    const noDate = createMockTask({ path: "t.md" });
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: null, rangeTo: null };
    expect(service.matchesDueDateFilter(task, filter)).toBe(true);
    expect(service.matchesDueDateFilter(noDate, filter)).toBe(true);
  });
});

describe("TaskFilterService.matchesDueDateFilter — range mode (custom rangeFrom/rangeTo)", () => {
  const today = new Date().toISOString().split("T")[0];

  it("custom range today→today — matches only today's date", () => {
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: today, rangeTo: today };
    const taskToday = createMockTask({ path: "t.md", due: today });
    expect(service.matchesDueDateFilter(taskToday, filter)).toBe(true);

    const taskOld = createMockTask({ path: "t.md", due: "2020-01-01" });
    expect(service.matchesDueDateFilter(taskOld, filter)).toBe(false);
  });

  it("custom range tomorrow→tomorrow — matches only tomorrow's date", () => {
    const tomorrow = offsetDate(1);
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: tomorrow, rangeTo: tomorrow };
    const taskTomorrow = createMockTask({ path: "t.md", due: tomorrow });
    expect(service.matchesDueDateFilter(taskTomorrow, filter)).toBe(true);

    const taskToday = createMockTask({ path: "t.md", due: today });
    expect(service.matchesDueDateFilter(taskToday, filter)).toBe(false);
  });

  it("custom range today→+7 — matches tasks due today through +7 days (inclusive)", () => {
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: today, rangeTo: offsetDate(7) };
    const taskToday = createMockTask({ path: "t.md", due: today });
    const taskPlus3 = createMockTask({ path: "t.md", due: offsetDate(3) });
    const taskPlus7 = createMockTask({ path: "t.md", due: offsetDate(7) });
    const taskPlus8 = createMockTask({ path: "t.md", due: offsetDate(8) });
    const taskPast = createMockTask({ path: "t.md", due: "2020-01-01" });

    expect(service.matchesDueDateFilter(taskToday, filter)).toBe(true);
    expect(service.matchesDueDateFilter(taskPlus3, filter)).toBe(true);
    expect(service.matchesDueDateFilter(taskPlus7, filter)).toBe(true);
    expect(service.matchesDueDateFilter(taskPlus8, filter)).toBe(false);
    expect(service.matchesDueDateFilter(taskPast, filter)).toBe(false);
  });

  it("custom range — exact boundaries (rangeFrom and rangeTo) are included", () => {
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: today, rangeTo: offsetDate(7) };
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: today }), filter)).toBe(true);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: offsetDate(7) }), filter)).toBe(true);
  });

  it("custom range +8→+14 — matches tasks due +8 through +14 days", () => {
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: offsetDate(8), rangeTo: offsetDate(14) };
    const taskPlus7 = createMockTask({ path: "t.md", due: offsetDate(7) });
    const taskPlus8 = createMockTask({ path: "t.md", due: offsetDate(8) });
    const taskPlus14 = createMockTask({ path: "t.md", due: offsetDate(14) });
    const taskPlus15 = createMockTask({ path: "t.md", due: offsetDate(15) });

    expect(service.matchesDueDateFilter(taskPlus7, filter)).toBe(false);
    expect(service.matchesDueDateFilter(taskPlus8, filter)).toBe(true);
    expect(service.matchesDueDateFilter(taskPlus14, filter)).toBe(true);
    expect(service.matchesDueDateFilter(taskPlus15, filter)).toBe(false);
  });

  it("custom range null→yesterday — matches dates strictly before today", () => {
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: null, rangeTo: offsetDate(-1) };
    const overdueTask = createMockTask({ path: "t.md", due: "2020-01-01" });
    expect(service.matchesDueDateFilter(overdueTask, filter)).toBe(true);

    const todayTask = createMockTask({ path: "t.md", due: today });
    expect(service.matchesDueDateFilter(todayTask, filter)).toBe(false);

    const noDateTask = createMockTask({ path: "t.md" });
    expect(service.matchesDueDateFilter(noDateTask, filter)).toBe(false);
  });

  it("range from-only: tasks on/after rangeFrom pass, before fail", () => {
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: "2025-06-01", rangeTo: null };
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-06-01" }), filter)).toBe(true);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-07-15" }), filter)).toBe(true);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-05-31" }), filter)).toBe(false);
  });

  it("range to-only: tasks on/before rangeTo pass, after fail", () => {
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: null, rangeTo: "2025-06-30" };
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-06-30" }), filter)).toBe(true);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-01-01" }), filter)).toBe(true);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-07-01" }), filter)).toBe(false);
  });

  it("range from+to: tasks within range pass, outside fail", () => {
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: "2025-06-01", rangeTo: "2025-06-30" };
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-06-15" }), filter)).toBe(true);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-05-31" }), filter)).toBe(false);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-07-01" }), filter)).toBe(false);
  });

  it("range boundaries are inclusive (exact rangeFrom and rangeTo dates pass)", () => {
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: "2025-06-01", rangeTo: "2025-06-30" };
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-06-01" }), filter)).toBe(true);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-06-30" }), filter)).toBe(true);
  });

  it("no-date task is excluded when no 'No Date' preset and a range is active", () => {
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: "2025-06-01", rangeTo: "2025-06-30" };
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md" }), filter)).toBe(false);
  });
});

describe("TaskFilterService.matchesDueDateFilter — selectedPresets", () => {
  it("task with no due date returns true when 'No Date' preset is selected and no range", () => {
    const filter: DueDateFilter = { selectedPresets: ["No Date"], rangeFrom: null, rangeTo: null };
    const noDate = createMockTask({ path: "t.md" });
    expect(service.matchesDueDateFilter(noDate, filter)).toBe(true);
  });

  it("task with no due date returns true when filter is inactive (no presets, no range)", () => {
    // When all fields are empty/null, filter is inactive — everything passes
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: null, rangeTo: null };
    const noDate = createMockTask({ path: "t.md" });
    expect(service.matchesDueDateFilter(noDate, filter)).toBe(true);
  });

  it("task with no due date returns false when a range is active but no 'No Date' preset", () => {
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: "2025-06-01", rangeTo: "2025-06-30" };
    const noDate = createMockTask({ path: "t.md" });
    expect(service.matchesDueDateFilter(noDate, filter)).toBe(false);
  });

  it("task with no due date returns true when 'No Date' preset is selected alongside a date range", () => {
    const filter: DueDateFilter = { selectedPresets: ["No Date"], rangeFrom: "2025-06-01", rangeTo: "2025-06-30" };
    const noDate = createMockTask({ path: "t.md" });
    expect(service.matchesDueDateFilter(noDate, filter)).toBe(true);
  });

  it("'No Date' preset — matches tasks with no due date, excludes tasks with due dates", () => {
    const filter: DueDateFilter = { selectedPresets: ["No Date"], rangeFrom: null, rangeTo: null };
    const noDate = createMockTask({ path: "t.md" });
    expect(service.matchesDueDateFilter(noDate, filter)).toBe(true);

    const today = new Date().toISOString().split("T")[0];
    const withDate = createMockTask({ path: "t.md", due: today });
    // A task with a due date does NOT match "No Date" preset alone
    expect(service.matchesDueDateFilter(withDate, filter)).toBe(false);
  });

  it("'Today' preset — matches tasks due today", () => {
    const today = new Date().toISOString().split("T")[0];
    const filter: DueDateFilter = { selectedPresets: ["Today"], rangeFrom: null, rangeTo: null };
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: today }), filter)).toBe(true);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2020-01-01" }), filter)).toBe(false);
  });

  it("'Overdue' preset — matches tasks due before today", () => {
    const filter: DueDateFilter = { selectedPresets: ["Overdue"], rangeFrom: null, rangeTo: null };
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2020-01-01" }), filter)).toBe(true);
    const today = new Date().toISOString().split("T")[0];
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: today }), filter)).toBe(false);
  });

  it("OR logic: two presets active — task matches if it satisfies either", () => {
    const today = new Date().toISOString().split("T")[0];
    const filter: DueDateFilter = { selectedPresets: ["Today", "Overdue"], rangeFrom: null, rangeTo: null };
    const overdueTask = createMockTask({ path: "t.md", due: "2020-01-01" });
    const todayTask = createMockTask({ path: "t.md", due: today });
    const futureTask = createMockTask({ path: "t.md", due: "2099-12-31" });
    expect(service.matchesDueDateFilter(overdueTask, filter)).toBe(true);
    expect(service.matchesDueDateFilter(todayTask, filter)).toBe(true);
    expect(service.matchesDueDateFilter(futureTask, filter)).toBe(false);
  });

  it("OR logic: 'No Date' and 'Today' both active — no-date task and today-dated task both pass", () => {
    const today = new Date().toISOString().split("T")[0];
    const filter: DueDateFilter = { selectedPresets: ["No Date", "Today"], rangeFrom: null, rangeTo: null };
    const noDate = createMockTask({ path: "t.md" });
    const todayTask = createMockTask({ path: "t.md", due: today });
    const futureTask = createMockTask({ path: "t.md", due: "2099-12-31" });
    expect(service.matchesDueDateFilter(noDate, filter)).toBe(true);
    expect(service.matchesDueDateFilter(todayTask, filter)).toBe(true);
    expect(service.matchesDueDateFilter(futureTask, filter)).toBe(false);
  });
});

describe("TaskFilterService.isDueDateFilterActive (via matchesDueDateFilter)", () => {
  it("filter is inactive when selectedPresets=[], rangeFrom=null, rangeTo=null", () => {
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: null, rangeTo: null };
    // Inactive filter passes all tasks
    const task = createMockTask({ path: "t.md", due: "2020-01-01" });
    const noDate = createMockTask({ path: "t.md" });
    expect(service.matchesDueDateFilter(task, filter)).toBe(true);
    expect(service.matchesDueDateFilter(noDate, filter)).toBe(true);
  });

  it("filter is active when rangeFrom is set", () => {
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: "2025-01-01", rangeTo: null };
    const beforeRange = createMockTask({ path: "t.md", due: "2024-12-31" });
    expect(service.matchesDueDateFilter(beforeRange, filter)).toBe(false);
  });

  it("filter is active when rangeTo is set", () => {
    const filter: DueDateFilter = { selectedPresets: [], rangeFrom: null, rangeTo: "2025-01-01" };
    const afterRange = createMockTask({ path: "t.md", due: "2025-01-02" });
    expect(service.matchesDueDateFilter(afterRange, filter)).toBe(false);
  });

  it("filter is active when 'No Date' preset is selected", () => {
    const filter: DueDateFilter = { selectedPresets: ["No Date"], rangeFrom: null, rangeTo: null };
    // Active: tasks with no date should pass
    const noDate = createMockTask({ path: "t.md" });
    expect(service.matchesDueDateFilter(noDate, filter)).toBe(true);
  });
});

// ─── matchesMeetingDateFilter ─────────────────────────────────────────────

describe("TaskFilterService.matchesMeetingDateFilter", () => {
  const today = new Date().toISOString().split("T")[0];

  it("All — always returns true", () => {
    expect(service.matchesMeetingDateFilter("2020-01-01", "All")).toBe(true);
  });

  it("Today — matches today's date", () => {
    expect(service.matchesMeetingDateFilter(today, "Today")).toBe(true);
    expect(service.matchesMeetingDateFilter("2020-01-01", "Today")).toBe(false);
  });

  it("Past — matches dates before today", () => {
    expect(service.matchesMeetingDateFilter("2020-01-01", "Past")).toBe(true);
    expect(service.matchesMeetingDateFilter(today, "Past")).toBe(false);
  });

  it("This Week — matches dates in next 7 days", () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 3);
    const nextWeekStr = nextWeek.toISOString().split("T")[0];

    expect(service.matchesMeetingDateFilter(nextWeekStr, "This Week")).toBe(true);
    expect(service.matchesMeetingDateFilter("2020-01-01", "This Week")).toBe(false);
  });
});

// ─── matchesClientFilter ──────────────────────────────────────────────────

describe("TaskFilterService.matchesClientFilter", () => {
  it("returns true when filter is empty and includeUnassigned is false", () => {
    const dv = createMockDataviewApi([{ path: "inbox/t.md" }]);
    const task = createMockTask({ path: "inbox/t.md" });
    expect(service.matchesClientFilter(task, [], false, dv, makeHierarchyService())).toBe(true);
  });

  it("matches task with direct client frontmatter", () => {
    const dv = createMockDataviewApi([
      {
        path: "projects/Foo.md",
        frontmatter: { client: { path: "clients/Acme.md" } },
      },
    ]);
    const task = createMockTask({ path: "projects/Foo.md" });
    // matchesClientFilter delegates resolution entirely to hierarchyService
    const hs = makeHierarchyService({ resolveClientName: () => "Acme" });
    expect(service.matchesClientFilter(task, ["Acme"], false, dv, hs)).toBe(true);
    expect(service.matchesClientFilter(task, ["Other"], false, dv, hs)).toBe(false);
  });

  it("includes unassigned tasks when includeUnassigned is true", () => {
    const dv = createMockDataviewApi([{ path: "inbox/t.md" }]);
    const task = createMockTask({ path: "inbox/t.md" });
    expect(service.matchesClientFilter(task, [], true, dv, makeHierarchyService())).toBe(true);
  });

  it("traverses engagement chain to find client", () => {
    const dv = createMockDataviewApi([
      {
        path: "projects/Foo.md",
        frontmatter: { engagement: "[[My Eng]]" },
      },
    ]);
    const task = createMockTask({ path: "projects/Foo.md" });
    const hs = makeHierarchyService({ resolveClientName: () => "Acme" });
    expect(service.matchesClientFilter(task, ["Acme"], false, dv, hs)).toBe(true);
    expect(service.matchesClientFilter(task, ["Other"], false, dv, hs)).toBe(false);
  });

  it("traverses parent project chain for project notes", () => {
    const dv = createMockDataviewApi([
      {
        path: "projects/notes/foo/Note.md",
        frontmatter: { relatedProject: "Foo" },
      },
      {
        path: "projects/Foo.md",
        frontmatter: { client: { path: "clients/Acme.md" } },
      },
    ]);
    const task = createMockTask({ path: "projects/notes/foo/Note.md" });
    // Note page has no client/engagement; parent project page has a direct client.
    // The fallback branch in matchesClientFilter loads the parent project and calls
    // resolveClientName on it — so the mock must return "Acme" for that page.
    const hs = makeHierarchyService({
      resolveClientName: (page) => page.file.path === "projects/Foo.md" ? "Acme" : null,
    });
    expect(service.matchesClientFilter(task, ["Acme"], false, dv, hs)).toBe(true);
  });

  it("treats a task with {path: ''} client as unassigned", () => {
    const dv = createMockDataviewApi([
      {
        path: "projects/Foo.md",
        frontmatter: { client: { path: "" } },
      },
    ]);
    const task = createMockTask({ path: "projects/Foo.md" });
    // Should be treated as unassigned — included when includeUnassigned is true
    expect(service.matchesClientFilter(task, [], true, dv, makeHierarchyService())).toBe(true);
    // Should NOT be included when a specific client filter is active
    expect(service.matchesClientFilter(task, ["Acme"], false, dv, makeHierarchyService())).toBe(false);
  });

  it("checkbox-only mode (no clients selected + includeUnassigned=true) excludes tasks with valid clients", () => {
    const dv = createMockDataviewApi([
      {
        path: "projects/Foo.md",
        frontmatter: { client: { path: "clients/Acme.md" } },
      },
    ]);
    const task = createMockTask({ path: "projects/Foo.md" });
    // clientFilter is empty but includeUnassigned=true — assigned task should be excluded
    const hs = makeHierarchyService({ resolveClientName: () => "Acme" });
    expect(service.matchesClientFilter(task, [], true, dv, hs)).toBe(false);
  });
});

// ─── matchesEngagementFilter ──────────────────────────────────────────────

describe("TaskFilterService.matchesEngagementFilter", () => {
  it("returns true when filter is empty and includeUnassigned is false", () => {
    const dv = createMockDataviewApi([{ path: "inbox/t.md" }]);
    const task = createMockTask({ path: "inbox/t.md" });
    expect(service.matchesEngagementFilter(task, [], false, dv, makeHierarchyService())).toBe(true);
  });

  it("matches task with direct engagement frontmatter", () => {
    const dv = createMockDataviewApi([{ path: "projects/Foo.md", frontmatter: { engagement: "[[Eng1]]" } }]);
    const task = createMockTask({ path: "projects/Foo.md" });
    const hs = makeHierarchyService({ resolveEngagementName: () => "Eng1" });
    expect(service.matchesEngagementFilter(task, ["Eng1"], false, dv, hs)).toBe(true);
    expect(service.matchesEngagementFilter(task, ["Other"], false, dv, hs)).toBe(false);
  });

  it("includes unassigned tasks when includeUnassigned is true", () => {
    const dv = createMockDataviewApi([{ path: "inbox/t.md" }]);
    const task = createMockTask({ path: "inbox/t.md" });
    expect(service.matchesEngagementFilter(task, [], true, dv, makeHierarchyService())).toBe(true);
  });

  it("traverses parent project chain for project notes", () => {
    const dv = createMockDataviewApi([{ path: "projects/notes/foo/Note.md", frontmatter: { relatedProject: "Foo" } }]);
    const task = createMockTask({ path: "projects/notes/foo/Note.md" });
    const hs = makeHierarchyService({ resolveEngagementName: () => "Eng1" });
    expect(service.matchesEngagementFilter(task, ["Eng1"], false, dv, hs)).toBe(true);
  });
});

// ─── matchesClientFilter / matchesEngagementFilter — recurring meeting events ─

describe("TaskFilterService — recurring meeting event traversal", () => {
  it("engagement filter: matches via recurring-meeting → parent meeting engagement (happy path)", () => {
    const dv = createMockDataviewApi([
      { path: "meetings/recurring-events/StandUp/2024-03-01.md" },
    ]);
    const task = createMockTask({ path: "meetings/recurring-events/StandUp/2024-03-01.md" });
    const hs = makeHierarchyService({ resolveEngagementName: () => "Acme Q1" });
    expect(service.matchesEngagementFilter(task, ["Acme Q1"], false, dv, hs)).toBe(true);
  });

  it("client filter: matches via recurring-meeting → parent meeting engagement → client (happy path)", () => {
    const dv = createMockDataviewApi([
      { path: "meetings/recurring-events/StandUp/2024-03-01.md", frontmatter: { "recurring-meeting": "StandUp" } },
    ]);
    const task = createMockTask({ path: "meetings/recurring-events/StandUp/2024-03-01.md" });
    const hs = makeHierarchyService({ resolveClientName: () => "Acme Corp" });
    expect(service.matchesClientFilter(task, ["Acme Corp"], false, dv, hs)).toBe(true);
  });

  it("engagement filter: returns false when parent meeting has a different engagement", () => {
    const dv = createMockDataviewApi([
      { path: "meetings/recurring-events/StandUp/2024-03-01.md" },
    ]);
    const task = createMockTask({ path: "meetings/recurring-events/StandUp/2024-03-01.md" });
    const hs = makeHierarchyService({ resolveEngagementName: () => "Other Q1" });
    expect(service.matchesEngagementFilter(task, ["Acme Q1"], false, dv, hs)).toBe(false);
  });

  it("engagement filter: treats event as unassigned when hierarchyService resolves no engagement", () => {
    const dv = createMockDataviewApi([
      { path: "meetings/recurring-events/StandUp/2024-03-01.md" },
    ]);
    const task = createMockTask({ path: "meetings/recurring-events/StandUp/2024-03-01.md" });
    expect(service.matchesEngagementFilter(task, [], true, dv, makeHierarchyService())).toBe(true);
    expect(service.matchesEngagementFilter(task, ["Acme Q1"], false, dv, makeHierarchyService())).toBe(false);
  });

  it("client filter: treats event as unassigned when hierarchyService resolves no client", () => {
    const dv = createMockDataviewApi([
      { path: "meetings/recurring-events/StandUp/2024-03-01.md", frontmatter: { "recurring-meeting": "StandUp" } },
    ]);
    const task = createMockTask({ path: "meetings/recurring-events/StandUp/2024-03-01.md" });
    expect(service.matchesClientFilter(task, [], true, dv, makeHierarchyService())).toBe(true);
    expect(service.matchesClientFilter(task, ["Acme Corp"], false, dv, makeHierarchyService())).toBe(false);
  });
});

// ─── applyContextSpecificFilters ─────────────────────────────────────────

describe("TaskFilterService.applyContextSpecificFilters", () => {
  it("filters project tasks by project status", () => {
    const dv = createMockDataviewApi([
      { path: "projects/Active.md", frontmatter: { status: "Active" } },
      { path: "projects/OnHold.md", frontmatter: { status: "On Hold" } },
    ]);
    const tasks = [
      createMockTask({ path: "projects/Active.md" }),
      createMockTask({ path: "projects/OnHold.md" }),
    ];
    const result = service.applyContextSpecificFilters(
      tasks,
      { projectStatusFilter: ["Active"], inboxStatusFilter: "All", meetingDateFilter: "All" },
      dv
    );
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("projects/Active.md");
  });

  it("passes through non-project tasks when project status filter is set", () => {
    const dv = createMockDataviewApi([
      { path: "projects/OnHold.md", frontmatter: { status: "On Hold" } },
    ]);
    const tasks = [
      createMockTask({ path: "inbox/t.md" }),             // Non-project — should pass through
      createMockTask({ path: "projects/OnHold.md" }),     // Project — filtered out
    ];
    const result = service.applyContextSpecificFilters(
      tasks,
      { projectStatusFilter: ["Active"], inboxStatusFilter: "All", meetingDateFilter: "All" },
      dv
    );
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("inbox/t.md");
  });

  it("filters inbox tasks by inbox status", () => {
    const dv = createMockDataviewApi([
      { path: "inbox/Active.md", frontmatter: { status: "Active" } },
      { path: "inbox/Complete.md", frontmatter: { status: "Complete" } },
    ]);
    const tasks = [
      createMockTask({ path: "inbox/Active.md" }),
      createMockTask({ path: "inbox/Complete.md" }),
    ];
    const result = service.applyContextSpecificFilters(
      tasks,
      { projectStatusFilter: [], inboxStatusFilter: "Active", meetingDateFilter: "All" },
      dv
    );
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("inbox/Active.md");
  });

  it("filters meeting tasks by meeting date", () => {
    const today = new Date().toISOString().split("T")[0];
    const dv = createMockDataviewApi([
      { path: "meetings/single/Today.md", frontmatter: { date: today } },
      { path: "meetings/single/OldMeeting.md", frontmatter: { date: "2020-01-01" } },
    ]);
    const tasks = [
      createMockTask({ path: "meetings/single/Today.md" }),
      createMockTask({ path: "meetings/single/OldMeeting.md" }),
    ];
    const result = service.applyContextSpecificFilters(
      tasks,
      { projectStatusFilter: [], inboxStatusFilter: "All", meetingDateFilter: "Today" },
      dv
    );
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("meetings/single/Today.md");
  });

  it("filters recurring-event meeting tasks by meeting date", () => {
    const today = new Date().toISOString().split("T")[0];
    const dv = createMockDataviewApi([
      { path: "meetings/recurring-events/StandUp/2024-01-15.md", frontmatter: { date: today } },
      { path: "meetings/recurring-events/StandUp/OldEvent.md", frontmatter: { date: "2020-01-01" } },
      { path: "meetings/recurring-events/StandUp/NoDate.md", frontmatter: {} },
    ]);
    const tasks = [
      createMockTask({ path: "meetings/recurring-events/StandUp/2024-01-15.md" }),
      createMockTask({ path: "meetings/recurring-events/StandUp/OldEvent.md" }),
      createMockTask({ path: "meetings/recurring-events/StandUp/NoDate.md" }),
    ];

    // meetingDateFilter: "Today" — only the today-dated event passes
    const resultToday = service.applyContextSpecificFilters(
      tasks,
      { projectStatusFilter: [], inboxStatusFilter: "All", meetingDateFilter: "Today" },
      dv
    );
    expect(resultToday).toHaveLength(1);
    expect(resultToday[0].path).toBe("meetings/recurring-events/StandUp/2024-01-15.md");

    // meetingDateFilter: "All" — recurring-event file with no date frontmatter passes through
    const resultAll = service.applyContextSpecificFilters(
      [createMockTask({ path: "meetings/recurring-events/StandUp/NoDate.md" })],
      { projectStatusFilter: [], inboxStatusFilter: "All", meetingDateFilter: "All" },
      dv
    );
    expect(resultAll).toHaveLength(1);
    expect(resultAll[0].path).toBe("meetings/recurring-events/StandUp/NoDate.md");
  });

  it("contextFilter ['Recurring Meeting'] isolates recurring-event tasks and excludes single-meeting tasks", () => {
    const dv = createMockDataviewApi([
      { path: "meetings/recurring-events/StandUp/2024-01-15.md" },
      { path: "meetings/single/Standup.md" },
    ]);
    const tasks = [
      createMockTask({ path: "meetings/recurring-events/StandUp/2024-01-15.md" }),
      createMockTask({ path: "meetings/single/Standup.md" }),
    ];
    const result = service.applyDashboardFilters(
      tasks,
      makeFilters({ contextFilter: ["Recurring Meeting"] }),
      dv,
      makeHierarchyService()
    );
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("meetings/recurring-events/StandUp/2024-01-15.md");
  });

  it("contextFilter ['Meeting'] excludes recurring-event tasks", () => {
    const dv = createMockDataviewApi([
      { path: "meetings/recurring-events/StandUp/2024-01-15.md" },
      { path: "meetings/single/Standup.md" },
    ]);
    const tasks = [
      createMockTask({ path: "meetings/recurring-events/StandUp/2024-01-15.md" }),
      createMockTask({ path: "meetings/single/Standup.md" }),
    ];
    const result = service.applyDashboardFilters(
      tasks,
      makeFilters({ contextFilter: ["Meeting"] }),
      dv,
      makeHierarchyService()
    );
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("meetings/single/Standup.md");
  });
});

// ─── matchesTagFilter ─────────────────────────────────────────────────────

describe("TaskFilterService.matchesTagFilter", () => {
  it("no filter (empty tagFilter, includeUntagged=false) — all tasks pass", () => {
    const taskWithTag = createMockTask({ path: "t.md", tags: ["#work"] });
    const taskNoTag = createMockTask({ path: "t.md", tags: [] });
    expect(service.matchesTagFilter(taskWithTag, [], false)).toBe(true);
    expect(service.matchesTagFilter(taskNoTag, [], false)).toBe(true);
  });

  it("single tag selected — shows only tasks with that tag", () => {
    const taskMatch = createMockTask({ path: "t.md", tags: ["#work"] });
    const taskNoMatch = createMockTask({ path: "t.md", tags: ["#personal"] });
    const taskNoTag = createMockTask({ path: "t.md", tags: [] });

    expect(service.matchesTagFilter(taskMatch, ["#work"], false)).toBe(true);
    expect(service.matchesTagFilter(taskNoMatch, ["#work"], false)).toBe(false);
    expect(service.matchesTagFilter(taskNoTag, ["#work"], false)).toBe(false);
  });

  it("multiple tags (OR): task with any matching tag passes", () => {
    const taskWork = createMockTask({ path: "t.md", tags: ["#work"] });
    const taskPersonal = createMockTask({ path: "t.md", tags: ["#personal"] });
    const taskOther = createMockTask({ path: "t.md", tags: ["#other"] });

    const filter = ["#work", "#personal"];
    expect(service.matchesTagFilter(taskWork, filter, false)).toBe(true);
    expect(service.matchesTagFilter(taskPersonal, filter, false)).toBe(true);
    expect(service.matchesTagFilter(taskOther, filter, false)).toBe(false);
  });

  it("task with non-matching tags is excluded", () => {
    const task = createMockTask({ path: "t.md", tags: ["#unrelated"] });
    expect(service.matchesTagFilter(task, ["#work", "#personal"], false)).toBe(false);
  });

  it("includeUntagged=true alone (empty tagFilter) — shows only untagged tasks", () => {
    const taskNoTag = createMockTask({ path: "t.md", tags: [] });
    const taskWithTag = createMockTask({ path: "t.md", tags: ["#work"] });

    expect(service.matchesTagFilter(taskNoTag, [], true)).toBe(true);
    expect(service.matchesTagFilter(taskWithTag, [], true)).toBe(false);
  });

  it("includeUntagged=true + tagFilter — shows untagged OR tag-matched tasks", () => {
    const taskNoTag = createMockTask({ path: "t.md", tags: [] });
    const taskMatch = createMockTask({ path: "t.md", tags: ["#work"] });
    const taskNoMatch = createMockTask({ path: "t.md", tags: ["#personal"] });

    expect(service.matchesTagFilter(taskNoTag, ["#work"], true)).toBe(true);
    expect(service.matchesTagFilter(taskMatch, ["#work"], true)).toBe(true);
    expect(service.matchesTagFilter(taskNoMatch, ["#work"], true)).toBe(false);
  });

  it("includeUntagged=false with tags in filter — shows only matching-tagged tasks", () => {
    const taskMatch = createMockTask({ path: "t.md", tags: ["#work"] });
    const taskNoMatch = createMockTask({ path: "t.md", tags: ["#personal"] });
    const taskNoTag = createMockTask({ path: "t.md", tags: [] });

    expect(service.matchesTagFilter(taskMatch, ["#work"], false)).toBe(true);
    expect(service.matchesTagFilter(taskNoMatch, ["#work"], false)).toBe(false);
    expect(service.matchesTagFilter(taskNoTag, ["#work"], false)).toBe(false);
  });

  it("task with undefined tags treated as untagged", () => {
    const task = createMockTask({ path: "t.md" }); // no tags property
    expect(service.matchesTagFilter(task, [], true)).toBe(true);
    expect(service.matchesTagFilter(task, ["#work"], false)).toBe(false);
    expect(service.matchesTagFilter(task, ["#work"], true)).toBe(true);
  });
});
