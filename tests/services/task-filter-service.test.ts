import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskFilterService } from "../../src/services/task-filter-service";
import { createMockTask, createMockDataviewApi, createMockPage } from "../mocks/dataview-mock";
import type { DashboardFilters } from "../../src/types";

// ─── Test helpers ─────────────────────────────────────────────────────────

function makeFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return {
    viewMode: "context",
    sortBy: "none",
    showCompleted: true,
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

// Minimal QueryService mock
function makeQueryService(overrides: Partial<{ getClientFromEngagementLink: (link: unknown) => string | null }> = {}) {
  return {
    getClientFromEngagementLink: overrides.getClientFromEngagementLink ?? (() => null),
  } as unknown as import("../../src/services/query-service").QueryService;
}

const service = new TaskFilterService();

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

  it("filters by due date", () => {
    const dv = createMockDataviewApi([]);
    const today = new Date().toISOString().split("T")[0];
    const tasks = [
      createMockTask({ path: "inbox/t.md", due: today }),
      createMockTask({ path: "inbox/t.md" }), // no due date
    ];
    const result = service.applyDashboardFilters(
      tasks,
      makeFilters({ dueDateFilter: "Today" }),
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

describe("TaskFilterService.matchesDueDateFilter", () => {
  const today = new Date().toISOString().split("T")[0];

  it("All — always returns true", () => {
    const task = createMockTask({ path: "t.md" });
    expect(service.matchesDueDateFilter(task, "All")).toBe(true);
  });

  it("Today — matches only today's date", () => {
    const taskToday = createMockTask({ path: "t.md", due: today });
    expect(service.matchesDueDateFilter(taskToday, "Today")).toBe(true);

    const taskOld = createMockTask({ path: "t.md", due: "2020-01-01" });
    expect(service.matchesDueDateFilter(taskOld, "Today")).toBe(false);
  });

  it("Overdue — matches dates strictly before today", () => {
    const overdueTask = createMockTask({ path: "t.md", due: "2020-01-01" });
    expect(service.matchesDueDateFilter(overdueTask, "Overdue")).toBe(true);

    const todayTask = createMockTask({ path: "t.md", due: today });
    expect(service.matchesDueDateFilter(todayTask, "Overdue")).toBe(false);
  });

  it("No Date — matches tasks with no due date", () => {
    const noDate = createMockTask({ path: "t.md" });
    expect(service.matchesDueDateFilter(noDate, "No Date")).toBe(true);

    const withDate = createMockTask({ path: "t.md", due: today });
    expect(service.matchesDueDateFilter(withDate, "No Date")).toBe(false);
  });

  it("This Week — matches dates within the next 7 days", () => {
    const nextDayDate = new Date();
    nextDayDate.setDate(nextDayDate.getDate() + 3);
    const nextDay = nextDayDate.toISOString().split("T")[0];

    const inWeek = createMockTask({ path: "t.md", due: nextDay });
    expect(service.matchesDueDateFilter(inWeek, "This Week")).toBe(true);

    const farFuture = createMockTask({ path: "t.md", due: "2099-01-01" });
    expect(service.matchesDueDateFilter(farFuture, "This Week")).toBe(false);
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
      { path: "meetings/Today.md", frontmatter: { date: today } },
      { path: "meetings/OldMeeting.md", frontmatter: { date: "2020-01-01" } },
    ]);
    const tasks = [
      createMockTask({ path: "meetings/Today.md" }),
      createMockTask({ path: "meetings/OldMeeting.md" }),
    ];
    const result = service.applyContextSpecificFilters(
      tasks,
      { projectStatusFilter: [], inboxStatusFilter: "All", meetingDateFilter: "Today" },
      dv
    );
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("meetings/Today.md");
  });
});
