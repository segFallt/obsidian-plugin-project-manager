import { describe, it, expect } from "vitest";
import { TaskSortService } from "@/services/task-sort-service";
import { createMockTask } from "../mocks/dataview-mock";
import type { SortKey } from "@/types";

const service = new TaskSortService();

function task(path: string, opts: { due?: string; text?: string } = {}) {
  return createMockTask({
    path,
    text: opts.text ?? "Task",
    due: opts.due,
  });
}

// ─── sortTasks ────────────────────────────────────────────────────────────

describe("TaskSortService.sortTasks", () => {
  describe("sortBy: empty keys (none)", () => {
    it("returns tasks in original order", () => {
      const tasks = [
        task("a.md", { due: "2024-03-01" }),
        task("b.md", { due: "2024-01-01" }),
      ];
      const result = service.sortTasks(tasks, []);
      expect(result[0]).toBe(tasks[0]);
      expect(result[1]).toBe(tasks[1]);
    });

    it("returns a copy of the original array (not the same reference)", () => {
      const tasks = [task("a.md"), task("b.md")];
      const result = service.sortTasks(tasks, []);
      expect(result).not.toBe(tasks);
      expect(result[0]).toBe(tasks[0]);
      expect(result[1]).toBe(tasks[1]);
    });
  });

  describe("sortBy: dueDate-asc", () => {
    it("sorts tasks by due date ascending", () => {
      const tasks = [
        task("a.md", { due: "2024-03-01" }),
        task("b.md", { due: "2024-01-01" }),
        task("c.md", { due: "2024-02-01" }),
      ];
      const result = service.sortTasks(tasks, [{ field: "dueDate", direction: "asc" }]);
      // b (Jan) < c (Feb) < a (Mar)
      expect(result.map((t) => t.path)).toEqual(["b.md", "c.md", "a.md"]);
      expect(result[0].due).toBe("2024-01-01");
      expect(result[1].due).toBe("2024-02-01");
      expect(result[2].due).toBe("2024-03-01");
    });

    it("puts tasks with no due date at the end", () => {
      const tasks = [
        task("no-date.md"),
        task("b.md", { due: "2024-01-01" }),
      ];
      const result = service.sortTasks(tasks, [{ field: "dueDate", direction: "asc" }]);
      expect(result[0].path).toBe("b.md");
      expect(result[1].path).toBe("no-date.md");
    });
  });

  describe("sortBy: dueDate-desc", () => {
    it("sorts tasks by due date descending", () => {
      const tasks = [
        task("a.md", { due: "2024-01-01" }),
        task("b.md", { due: "2024-03-01" }),
      ];
      const result = service.sortTasks(tasks, [{ field: "dueDate", direction: "desc" }]);
      expect(result[0].due).toBe("2024-03-01");
      expect(result[1].due).toBe("2024-01-01");
    });

    it("puts tasks with no due date at the end (after dated tasks)", () => {
      const tasks = [
        task("b.md", { due: "2024-01-01" }),
        task("no-date.md"),
      ];
      const result = service.sortTasks(tasks, [{ field: "dueDate", direction: "desc" }]);
      expect(result[0].path).toBe("b.md");
      expect(result[1].path).toBe("no-date.md");
    });
  });

  describe("sortBy: priority-asc", () => {
    it("sorts tasks by priority ascending (1 = highest first)", () => {
      const tasks = [
        task("low.md", { text: "Low 🔽" }),
        task("urgent.md", { text: "Urgent ⏫" }),
        task("high.md", { text: "High 🔼" }),
      ];
      const result = service.sortTasks(tasks, [{ field: "priority", direction: "asc" }]);
      expect(result[0].path).toBe("urgent.md"); // priority 1
      expect(result[1].path).toBe("high.md");   // priority 2
      expect(result[2].path).toBe("low.md");    // priority 4
    });
  });

  describe("sortBy: priority-desc", () => {
    it("sorts tasks by priority descending (4 = lowest first)", () => {
      const tasks = [
        task("urgent.md", { text: "Urgent ⏫" }),
        task("low.md", { text: "Low 🔽" }),
      ];
      const result = service.sortTasks(tasks, [{ field: "priority", direction: "desc" }]);
      expect(result[0].path).toBe("low.md");    // priority 4 (lowest)
      expect(result[1].path).toBe("urgent.md"); // priority 1 (highest)
    });
  });

  it("does not mutate the original array", () => {
    const tasks = [
      task("b.md", { due: "2024-03-01" }),
      task("a.md", { due: "2024-01-01" }),
    ];
    const original = [...tasks];
    service.sortTasks(tasks, [{ field: "dueDate", direction: "asc" }]);
    expect(tasks[0]).toBe(original[0]);
    expect(tasks[1]).toBe(original[1]);
  });

  describe("multi-key sort", () => {
    it("primary key breaks ties; secondary key is used as tiebreaker", () => {
      const tasks = [
        task("a.md", { due: "2024-01-01", text: "Zebra ⏫" }),   // same date, priority 1
        task("b.md", { due: "2024-01-01", text: "Alpha 🔽" }),   // same date, priority 4
        task("c.md", { due: "2024-02-01", text: "Later task" }), // different date
      ];
      const keys: SortKey[] = [
        { field: "dueDate", direction: "asc" },
        { field: "priority", direction: "asc" },
      ];
      const result = service.sortTasks(tasks, keys);
      // c (Feb) comes last; a and b share Jan, but a has priority 1 (beats priority 4)
      expect(result[0].path).toBe("a.md"); // Jan, priority 1
      expect(result[1].path).toBe("b.md"); // Jan, priority 4
      expect(result[2].path).toBe("c.md"); // Feb
    });
  });

  describe("alphabetical field", () => {
    it("sorts by task.text case-insensitively", () => {
      const tasks = [
        task("a.md", { text: "Zebra task" }),
        task("b.md", { text: "apple task" }),
        task("c.md", { text: "Mango task" }),
      ];
      const result = service.sortTasks(tasks, [{ field: "alphabetical", direction: "asc" }]);
      expect(result.map((t) => t.path)).toEqual(["b.md", "c.md", "a.md"]);
    });

    it("sorts alphabetically in descending order", () => {
      const tasks = [
        task("a.md", { text: "apple" }),
        task("b.md", { text: "banana" }),
      ];
      const result = service.sortTasks(tasks, [{ field: "alphabetical", direction: "desc" }]);
      expect(result[0].path).toBe("b.md");
      expect(result[1].path).toBe("a.md");
    });
  });

  describe("context field", () => {
    it("sorts by value from contextMap", () => {
      const tasks = [
        task("a.md"),
        task("b.md"),
        task("c.md"),
      ];
      const contextMap = new Map([
        ["a.md", "Project"],
        ["b.md", "Inbox"],
        ["c.md", "Meeting"],
      ]);
      const result = service.sortTasks(tasks, [{ field: "context", direction: "asc" }], contextMap);
      // Inbox < Meeting < Project alphabetically
      expect(result.map((t) => t.path)).toEqual(["b.md", "c.md", "a.md"]);
    });
  });

  describe("createdDate field", () => {
    it("sorts by value from mtimeMap", () => {
      const tasks = [
        task("a.md"),
        task("b.md"),
        task("c.md"),
      ];
      const mtimeMap = new Map([
        ["a.md", 300],
        ["b.md", 100],
        ["c.md", 200],
      ]);
      const result = service.sortTasks(tasks, [{ field: "createdDate", direction: "asc" }], undefined, mtimeMap);
      expect(result.map((t) => t.path)).toEqual(["b.md", "c.md", "a.md"]);
    });
  });
});

// ─── compareGroups ────────────────────────────────────────────────────────

describe("TaskSortService.compareGroups", () => {
  it("returns 0 for empty keys array", () => {
    const a = [task("a.md", { due: "2024-01-01" })];
    const b = [task("b.md", { due: "2024-03-01" })];
    expect(service.compareGroups(a, b, [])).toBe(0);
  });

  it("orders groups by earliest due date ascending", () => {
    const a = [task("a.md", { due: "2024-03-01" })];
    const b = [task("b.md", { due: "2024-01-01" })];
    expect(service.compareGroups(a, b, [{ field: "dueDate", direction: "asc" }])).toBeGreaterThan(0);
    expect(service.compareGroups(b, a, [{ field: "dueDate", direction: "asc" }])).toBeLessThan(0);
  });

  it("orders groups by latest due date descending", () => {
    const a = [task("a.md", { due: "2024-01-01" })];
    const b = [task("b.md", { due: "2024-03-01" })];
    expect(service.compareGroups(a, b, [{ field: "dueDate", direction: "desc" }])).toBeGreaterThan(0);
  });

  it("orders groups by highest priority ascending", () => {
    const a = [task("a.md", { text: "Low 🔽" })];    // priority 4
    const b = [task("b.md", { text: "Urgent ⏫" })]; // priority 1
    expect(service.compareGroups(a, b, [{ field: "priority", direction: "asc" }])).toBeGreaterThan(0);
    expect(service.compareGroups(b, a, [{ field: "priority", direction: "asc" }])).toBeLessThan(0);
  });

  it("uses best date in group for comparison", () => {
    const a = [
      task("a1.md", { due: "2024-06-01" }),
      task("a2.md", { due: "2024-01-01" }), // earliest in group a
    ];
    const b = [task("b.md", { due: "2024-03-01" })];
    // group a's earliest date (2024-01-01) < group b (2024-03-01)
    expect(service.compareGroups(a, b, [{ field: "dueDate", direction: "asc" }])).toBeLessThan(0);
  });
});
