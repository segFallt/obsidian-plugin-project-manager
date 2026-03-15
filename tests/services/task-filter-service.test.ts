import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskFilterService } from "../../src/services/task-filter-service";
import { createMockTask, createMockDataviewApi, createMockPage } from "../mocks/dataview-mock";
import type { DashboardFilters, DueDateFilter } from "../../src/types";
import { DEFAULT_FOLDERS } from "../../src/constants";
import type { FolderSettings } from "../../src/settings";

const defaultFolders = DEFAULT_FOLDERS as unknown as FolderSettings;

// ─── Test helpers ─────────────────────────────────────────────────────────

/** Default DueDateFilter that shows all tasks (empty presets = "All"). */
const ALL_DUE_DATE_FILTER: DueDateFilter = { mode: "presets", presets: [], rangeFrom: null, rangeTo: null };

function makeFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return {
    viewMode: "context",
    sortBy: "none",
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

// Minimal QueryService mock
function makeQueryService(overrides: Partial<{ getClientFromEngagementLink: (link: unknown) => string | null }> = {}) {
  return {
    getClientFromEngagementLink: overrides.getClientFromEngagementLink ?? (() => null),
  } as unknown as import("../../src/services/query-service").QueryService;
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
    const result = service.applyDashboardFilters(tasks, makeFilters(), dv, makeQueryService());
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
      makeQueryService()
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
      makeQueryService()
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
      makeQueryService()
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
      makeFilters({ dueDateFilter: { mode: "presets", presets: ["Today"], rangeFrom: null, rangeTo: null } }),
      dv,
      makeQueryService()
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
      makeQueryService()
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

describe("TaskFilterService.matchesDueDateFilter — preset mode", () => {
  const today = new Date().toISOString().split("T")[0];

  function makePresetFilter(...presets: DueDateFilter["presets"]): DueDateFilter {
    return { mode: "presets", presets, rangeFrom: null, rangeTo: null };
  }

  it("empty presets — shows all tasks (equivalent to All)", () => {
    const task = createMockTask({ path: "t.md" });
    const noDate = createMockTask({ path: "t.md" });
    expect(service.matchesDueDateFilter(task, makePresetFilter())).toBe(true);
    expect(service.matchesDueDateFilter(noDate, makePresetFilter())).toBe(true);
  });

  it("Today — matches only today's date", () => {
    const taskToday = createMockTask({ path: "t.md", due: today });
    expect(service.matchesDueDateFilter(taskToday, makePresetFilter("Today"))).toBe(true);

    const taskOld = createMockTask({ path: "t.md", due: "2020-01-01" });
    expect(service.matchesDueDateFilter(taskOld, makePresetFilter("Today"))).toBe(false);
  });

  it("Tomorrow — matches only tomorrow's date", () => {
    const tomorrow = offsetDate(1);
    const taskTomorrow = createMockTask({ path: "t.md", due: tomorrow });
    expect(service.matchesDueDateFilter(taskTomorrow, makePresetFilter("Tomorrow"))).toBe(true);

    const taskToday = createMockTask({ path: "t.md", due: today });
    expect(service.matchesDueDateFilter(taskToday, makePresetFilter("Tomorrow"))).toBe(false);
  });

  it("This Week — matches tasks due today through +7 days (inclusive)", () => {
    const taskToday = createMockTask({ path: "t.md", due: today });
    const taskPlus3 = createMockTask({ path: "t.md", due: offsetDate(3) });
    const taskPlus7 = createMockTask({ path: "t.md", due: offsetDate(7) });
    const taskPlus8 = createMockTask({ path: "t.md", due: offsetDate(8) });
    const taskPast = createMockTask({ path: "t.md", due: "2020-01-01" });

    expect(service.matchesDueDateFilter(taskToday, makePresetFilter("This Week"))).toBe(true);
    expect(service.matchesDueDateFilter(taskPlus3, makePresetFilter("This Week"))).toBe(true);
    expect(service.matchesDueDateFilter(taskPlus7, makePresetFilter("This Week"))).toBe(true);
    expect(service.matchesDueDateFilter(taskPlus8, makePresetFilter("This Week"))).toBe(false);
    expect(service.matchesDueDateFilter(taskPast, makePresetFilter("This Week"))).toBe(false);
  });

  it("This Week — exact boundaries (today and today+7) are included", () => {
    expect(service.matchesDueDateFilter(
      createMockTask({ path: "t.md", due: today }),
      makePresetFilter("This Week")
    )).toBe(true);
    expect(service.matchesDueDateFilter(
      createMockTask({ path: "t.md", due: offsetDate(7) }),
      makePresetFilter("This Week")
    )).toBe(true);
  });

  it("Next Week — matches tasks due +8 through +14 days", () => {
    const taskPlus7 = createMockTask({ path: "t.md", due: offsetDate(7) });
    const taskPlus8 = createMockTask({ path: "t.md", due: offsetDate(8) });
    const taskPlus14 = createMockTask({ path: "t.md", due: offsetDate(14) });
    const taskPlus15 = createMockTask({ path: "t.md", due: offsetDate(15) });

    expect(service.matchesDueDateFilter(taskPlus7, makePresetFilter("Next Week"))).toBe(false);
    expect(service.matchesDueDateFilter(taskPlus8, makePresetFilter("Next Week"))).toBe(true);
    expect(service.matchesDueDateFilter(taskPlus14, makePresetFilter("Next Week"))).toBe(true);
    expect(service.matchesDueDateFilter(taskPlus15, makePresetFilter("Next Week"))).toBe(false);
  });

  it("Overdue — matches dates strictly before today", () => {
    const overdueTask = createMockTask({ path: "t.md", due: "2020-01-01" });
    expect(service.matchesDueDateFilter(overdueTask, makePresetFilter("Overdue"))).toBe(true);

    const todayTask = createMockTask({ path: "t.md", due: today });
    expect(service.matchesDueDateFilter(todayTask, makePresetFilter("Overdue"))).toBe(false);

    const noDateTask = createMockTask({ path: "t.md" });
    expect(service.matchesDueDateFilter(noDateTask, makePresetFilter("Overdue"))).toBe(false);
  });

  it("No Date — matches tasks with no due date", () => {
    const noDate = createMockTask({ path: "t.md" });
    expect(service.matchesDueDateFilter(noDate, makePresetFilter("No Date"))).toBe(true);

    const withDate = createMockTask({ path: "t.md", due: today });
    expect(service.matchesDueDateFilter(withDate, makePresetFilter("No Date"))).toBe(false);
  });

  it("Multi-preset OR: Overdue + Today shows both overdue and today tasks", () => {
    const overdueTask = createMockTask({ path: "t.md", due: "2020-01-01" });
    const todayTask = createMockTask({ path: "t.md", due: today });
    const tomorrowTask = createMockTask({ path: "t.md", due: offsetDate(1) });
    const noDateTask = createMockTask({ path: "t.md" });

    const filter = makePresetFilter("Overdue", "Today");
    expect(service.matchesDueDateFilter(overdueTask, filter)).toBe(true);
    expect(service.matchesDueDateFilter(todayTask, filter)).toBe(true);
    expect(service.matchesDueDateFilter(tomorrowTask, filter)).toBe(false);
    expect(service.matchesDueDateFilter(noDateTask, filter)).toBe(false);
  });
});

describe("TaskFilterService.matchesDueDateFilter — range mode", () => {
  function makeRangeFilter(rangeFrom: string | null, rangeTo: string | null): DueDateFilter {
    return { mode: "range", presets: [], rangeFrom, rangeTo };
  }

  it("range from-only: tasks on/after rangeFrom pass, before fail", () => {
    const filter = makeRangeFilter("2025-06-01", null);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-06-01" }), filter)).toBe(true);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-07-15" }), filter)).toBe(true);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-05-31" }), filter)).toBe(false);
  });

  it("range to-only: tasks on/before rangeTo pass, after fail", () => {
    const filter = makeRangeFilter(null, "2025-06-30");
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-06-30" }), filter)).toBe(true);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-01-01" }), filter)).toBe(true);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-07-01" }), filter)).toBe(false);
  });

  it("range from+to: tasks within range pass, outside fail", () => {
    const filter = makeRangeFilter("2025-06-01", "2025-06-30");
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-06-15" }), filter)).toBe(true);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-05-31" }), filter)).toBe(false);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-07-01" }), filter)).toBe(false);
  });

  it("range boundaries are inclusive (exact rangeFrom and rangeTo dates pass)", () => {
    const filter = makeRangeFilter("2025-06-01", "2025-06-30");
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-06-01" }), filter)).toBe(true);
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md", due: "2025-06-30" }), filter)).toBe(true);
  });

  it("no-date task is excluded from range mode", () => {
    const filter = makeRangeFilter("2025-06-01", "2025-06-30");
    expect(service.matchesDueDateFilter(createMockTask({ path: "t.md" }), filter)).toBe(false);
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
    expect(service.matchesClientFilter(task, [], false, dv, makeQueryService())).toBe(true);
  });

  it("matches task with direct client frontmatter", () => {
    const dv = createMockDataviewApi([
      {
        path: "projects/Foo.md",
        frontmatter: { client: { path: "clients/Acme.md" } },
      },
    ]);
    const task = createMockTask({ path: "projects/Foo.md" });
    expect(service.matchesClientFilter(task, ["Acme"], false, dv, makeQueryService())).toBe(true);
    expect(service.matchesClientFilter(task, ["Other"], false, dv, makeQueryService())).toBe(false);
  });

  it("includes unassigned tasks when includeUnassigned is true", () => {
    const dv = createMockDataviewApi([{ path: "inbox/t.md" }]);
    const task = createMockTask({ path: "inbox/t.md" });
    expect(service.matchesClientFilter(task, [], true, dv, makeQueryService())).toBe(true);
  });

  it("traverses engagement chain to find client", () => {
    const dv = createMockDataviewApi([
      {
        path: "projects/Foo.md",
        frontmatter: { engagement: "[[My Eng]]" },
      },
    ]);
    const task = createMockTask({ path: "projects/Foo.md" });
    const qs = makeQueryService({ getClientFromEngagementLink: () => "Acme" });
    expect(service.matchesClientFilter(task, ["Acme"], false, dv, qs)).toBe(true);
    expect(service.matchesClientFilter(task, ["Other"], false, dv, qs)).toBe(false);
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
    expect(service.matchesClientFilter(task, ["Acme"], false, dv, makeQueryService())).toBe(true);
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
    expect(service.matchesClientFilter(task, [], true, dv, makeQueryService())).toBe(true);
    // Should NOT be included when a specific client filter is active
    expect(service.matchesClientFilter(task, ["Acme"], false, dv, makeQueryService())).toBe(false);
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
    expect(service.matchesClientFilter(task, [], true, dv, makeQueryService())).toBe(false);
  });
});

// ─── matchesEngagementFilter ──────────────────────────────────────────────

describe("TaskFilterService.matchesEngagementFilter", () => {
  it("returns true when filter is empty and includeUnassigned is false", () => {
    const dv = createMockDataviewApi([{ path: "inbox/t.md" }]);
    const task = createMockTask({ path: "inbox/t.md" });
    expect(service.matchesEngagementFilter(task, [], false, dv)).toBe(true);
  });

  it("matches task with direct engagement frontmatter", () => {
    const dv = createMockDataviewApi([
      {
        path: "projects/Foo.md",
        frontmatter: { engagement: { path: "engagements/Eng1.md" } },
      },
    ]);
    const task = createMockTask({ path: "projects/Foo.md" });
    expect(service.matchesEngagementFilter(task, ["Eng1"], false, dv)).toBe(true);
    expect(service.matchesEngagementFilter(task, ["Other"], false, dv)).toBe(false);
  });

  it("includes unassigned tasks when includeUnassigned is true", () => {
    const dv = createMockDataviewApi([{ path: "inbox/t.md" }]);
    const task = createMockTask({ path: "inbox/t.md" });
    expect(service.matchesEngagementFilter(task, [], true, dv)).toBe(true);
  });

  it("traverses parent project chain for project notes", () => {
    const dv = createMockDataviewApi([
      {
        path: "projects/notes/foo/Note.md",
        frontmatter: { relatedProject: "Foo" },
      },
      {
        path: "projects/Foo.md",
        frontmatter: { engagement: { path: "engagements/Eng1.md" } },
      },
    ]);
    const task = createMockTask({ path: "projects/notes/foo/Note.md" });
    expect(service.matchesEngagementFilter(task, ["Eng1"], false, dv)).toBe(true);
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
