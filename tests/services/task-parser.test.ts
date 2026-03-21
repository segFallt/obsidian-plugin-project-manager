import { describe, it, expect } from "vitest";
import { TaskParser } from "../../src/services/task-parser";

describe("TaskParser", () => {
  const parser = new TaskParser();

  describe("parseTaskLine", () => {
    it("parses a simple incomplete task", () => {
      const result = parser.parseTaskLine("- [ ] Buy milk", "inbox/Shopping.md", 0);
      expect(result).not.toBeNull();
      expect(result?.text).toBe("Buy milk");
      expect(result?.completed).toBe(false);
      expect(result?.priority).toBe(3); // default medium
    });

    it("parses a completed task", () => {
      const result = parser.parseTaskLine("- [x] Done item", "projects/Foo.md", 1);
      expect(result?.completed).toBe(true);
    });

    it("extracts due date from 📅 emoji", () => {
      const result = parser.parseTaskLine("- [ ] Task 📅 2026-03-15", "foo.md", 0);
      expect(result?.dueDate).toBe("2026-03-15");
    });

    it("extracts completion date from ✅ emoji", () => {
      const result = parser.parseTaskLine("- [x] Done ✅ 2026-03-01", "foo.md", 0);
      expect(result?.completionDate).toBe("2026-03-01");
    });

    it("extracts priority from ⏫ (Urgent)", () => {
      const result = parser.parseTaskLine("- [ ] Urgent task ⏫", "foo.md", 0);
      expect(result?.priority).toBe(1);
    });

    it("extracts priority from 🔼 (High)", () => {
      const result = parser.parseTaskLine("- [ ] High priority 🔼", "foo.md", 0);
      expect(result?.priority).toBe(2);
    });

    it("extracts priority from 🔽 (Low)", () => {
      const result = parser.parseTaskLine("- [ ] Low priority 🔽", "foo.md", 0);
      expect(result?.priority).toBe(4);
    });

    it("extracts priority from ⏬ (Someday — unmapped, falls back to DEFAULT_PRIORITY)", () => {
      const result = parser.parseTaskLine("- [ ] Someday ⏬", "foo.md", 0);
      expect(result?.priority).toBe(3); // DEFAULT_PRIORITY fallback
    });

    it("defaults to medium priority (3) when no emoji", () => {
      const result = parser.parseTaskLine("- [ ] Plain task", "foo.md", 0);
      expect(result?.priority).toBe(3);
    });

    it("extracts tags from task text", () => {
      const result = parser.parseTaskLine("- [ ] Task #work #urgent", "foo.md", 0);
      expect(result?.tags).toContain("#work");
      expect(result?.tags).toContain("#urgent");
    });

    it("returns null for non-task lines", () => {
      expect(parser.parseTaskLine("## Heading", "foo.md", 0)).toBeNull();
      expect(parser.parseTaskLine("Normal paragraph", "foo.md", 0)).toBeNull();
      expect(parser.parseTaskLine("- Regular list item", "foo.md", 0)).toBeNull();
    });

    it("records file path and line number", () => {
      const result = parser.parseTaskLine("- [ ] Task", "projects/Foo.md", 42);
      expect(result?.filePath).toBe("projects/Foo.md");
      expect(result?.lineNumber).toBe(42);
    });

    it("handles indented tasks", () => {
      const result = parser.parseTaskLine("  - [ ] Indented", "foo.md", 0);
      expect(result).not.toBeNull();
      expect(result?.text).toBe("Indented");
    });
  });

  describe("parseTasksFromContent", () => {
    it("parses multiple tasks from content", () => {
      const content = `# Notes

- [ ] First task
- [x] Completed task
Not a task
- [ ] Third task 📅 2026-04-01 ⏫`;

      const tasks = parser.parseTasksFromContent(content, "foo.md");
      expect(tasks).toHaveLength(3);
      expect(tasks[0].text).toBe("First task");
      expect(tasks[1].completed).toBe(true);
      expect(tasks[2].dueDate).toBe("2026-04-01");
      expect(tasks[2].priority).toBe(1);
    });

    it("returns empty array for content with no tasks", () => {
      const tasks = parser.parseTasksFromContent("# Just a heading\n\nSome text.", "foo.md");
      expect(tasks).toHaveLength(0);
    });
  });

  describe("toggleTaskLine", () => {
    it("marks an incomplete task as complete", () => {
      const line = "- [ ] Buy milk";
      const result = parser.toggleTaskLine(line, true);
      expect(result).toContain("[x]");
      expect(result).toContain("✅");
      // Should contain today's date
      expect(result).toMatch(/✅ \d{4}-\d{2}-\d{2}/);
    });

    it("marks a complete task as incomplete", () => {
      const line = "- [x] Buy milk ✅ 2026-03-01";
      const result = parser.toggleTaskLine(line, false);
      expect(result).toContain("[ ]");
      expect(result).not.toContain("✅");
    });
  });
});
