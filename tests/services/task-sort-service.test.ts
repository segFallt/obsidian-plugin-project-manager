import { describe, it, expect } from "vitest";
import { TaskSortService } from "../../src/services/task-sort-service";
import { createMockTask } from "../mocks/dataview-mock";

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
  describe("sortBy: none", () => {
    it("returns tasks in original order", () => {
      const tasks = [
        task("a.md", { due: "2024-03-01" }),
        task("b.md", { due: "2024-01-01" }),
      ];
      const result = service.sortTasks(tasks, "none");
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
      const result = service.sortTasks(tasks, "dueDate-asc");
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
      const result = service.sortTasks(tasks, "dueDate-asc");
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
      const result = service.sortTasks(tasks, "dueDate-desc");
      expect(result[0].due).toBe("2024-03-01");
      expect(result[1].due).toBe("2024-01-01");
    });

    it("puts tasks with no due date at the start when descending", () => {
      const tasks = [
        task("b.md", { due: "2024-01-01" }),
        task("no-date.md"),
      ];
      const result = service.sortTasks(tasks, "dueDate-desc");
      expect(result[0].path).toBe("b.md");
      expect(result[1].path).toBe("no-date.md");
    });
  });

  describe("sortBy: priority-asc", () => {
    it("sorts tasks by priority ascending (1 = highest first)", () => {
      const tasks = [
        task("low.md", { text: "Low ⏬" }),
        task("urgent.md", { text: "Urgent ⏫" }),
        task("high.md", { text: "High 🔼" }),
      ];
      const result = service.sortTasks(tasks, "priority-asc");
      expect(result[0].path).toBe("urgent.md"); // priority 1
      expect(result[1].path).toBe("high.md");   // priority 2
      expect(result[2].path).toBe("low.md");    // priority 5
    });
  });

  describe("sortBy: priority-desc", () => {
    it("sorts tasks by priority descending (5 = lowest first)", () => {
      const tasks = [
        task("urgent.md", { text: "Urgent ⏫" }),
        task("low.md", { text: "Low ⏬" }),
      ];
      const result = service.sortTasks(tasks, "priority-desc");
      expect(result[0].path).toBe("low.md");    // priority 5
      expect(result[1].path).toBe("urgent.md"); // priority 1
    });
  });

  it("does not mutate the original array", () => {
    const tasks = [
      task("b.md", { due: "2024-03-01" }),
      task("a.md", { due: "2024-01-01" }),
    ];
    const original = [...tasks];
    service.sortTasks(tasks, "dueDate-asc");
    expect(tasks[0]).toBe(original[0]);
    expect(tasks[1]).toBe(original[1]);
  });
});

// ─── compareGroups ────────────────────────────────────────────────────────

describe("TaskSortService.compareGroups", () => {
  it("returns 0 for sortBy: none", () => {
    const a = [task("a.md", { due: "2024-01-01" })];
    const b = [task("b.md", { due: "2024-03-01" })];
    expect(service.compareGroups(a, b, "none")).toBe(0);
  });

  it("orders groups by earliest due date ascending", () => {
    const a = [task("a.md", { due: "2024-03-01" })];
    const b = [task("b.md", { due: "2024-01-01" })];
    expect(service.compareGroups(a, b, "dueDate-asc")).toBeGreaterThan(0);
    expect(service.compareGroups(b, a, "dueDate-asc")).toBeLessThan(0);
  });

  it("orders groups by latest due date descending", () => {
    const a = [task("a.md", { due: "2024-01-01" })];
    const b = [task("b.md", { due: "2024-03-01" })];
    expect(service.compareGroups(a, b, "dueDate-desc")).toBeGreaterThan(0);
  });

  it("orders groups by highest priority ascending", () => {
    const a = [task("a.md", { text: "Low ⏬" })];    // priority 5
    const b = [task("b.md", { text: "Urgent ⏫" })]; // priority 1
    expect(service.compareGroups(a, b, "priority-asc")).toBeGreaterThan(0);
    expect(service.compareGroups(b, a, "priority-asc")).toBeLessThan(0);
  });

  it("uses best date in group for comparison", () => {
    const a = [
      task("a1.md", { due: "2024-06-01" }),
      task("a2.md", { due: "2024-01-01" }), // earliest in group a
    ];
    const b = [task("b.md", { due: "2024-03-01" })];
    // group a's earliest date (2024-01-01) < group b (2024-03-01)
    expect(service.compareGroups(a, b, "dueDate-asc")).toBeLessThan(0);
  });
});
