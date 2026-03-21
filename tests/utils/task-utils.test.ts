import { describe, it, expect } from "vitest";
import {
  getTaskContext,
  getTaskPriority,
  cleanTaskText,
  extractEmojiDate,
  addDays,
  getParentRecurringMeetingPath,
} from "../../src/utils/task-utils";
import { createMockTask, createMockDataviewApi } from "../mocks/dataview-mock";
import { DEFAULT_FOLDERS } from "../../src/constants";
import type { FolderSettings } from "../../src/settings";

const defaultFolders = DEFAULT_FOLDERS as unknown as FolderSettings;

// ─── getTaskContext ────────────────────────────────────────────────────────

describe("getTaskContext", () => {
  it("returns Project for paths starting with projects/", () => {
    const task = createMockTask({ path: "projects/Foo.md" });
    expect(getTaskContext(task, defaultFolders)).toBe("Project");
  });

  it("returns Project for project sub-notes", () => {
    const task = createMockTask({ path: "projects/notes/foo/Note.md" });
    expect(getTaskContext(task, defaultFolders)).toBe("Project");
  });

  it("returns Person for paths starting with people/", () => {
    const task = createMockTask({ path: "people/Alice.md" });
    expect(getTaskContext(task, defaultFolders)).toBe("Person");
  });

  it("returns Meeting for paths starting with meetings/single/", () => {
    const task = createMockTask({ path: "meetings/single/Standup.md" });
    expect(getTaskContext(task, defaultFolders)).toBe("Meeting");
  });

  it("returns Meeting for paths starting with meetings/recurring/", () => {
    const task = createMockTask({ path: "meetings/recurring/Weekly.md" });
    expect(getTaskContext(task, defaultFolders)).toBe("Meeting");
  });

  it("returns Recurring Meeting for paths starting with meetings/recurring-events/", () => {
    const task = createMockTask({ path: "meetings/recurring-events/StandUp/2024-01-15.md" });
    expect(getTaskContext(task, defaultFolders)).toBe("Recurring Meeting");
  });

  it("returns Inbox for paths starting with inbox/", () => {
    const task = createMockTask({ path: "inbox/Task.md" });
    expect(getTaskContext(task, defaultFolders)).toBe("Inbox");
  });

  it("returns Daily Notes for paths starting with daily notes/", () => {
    const task = createMockTask({ path: "daily notes/2024-01-01.md" });
    expect(getTaskContext(task, defaultFolders)).toBe("Daily Notes");
  });

  it("returns Other for paths that don't match any known prefix", () => {
    const task = createMockTask({ path: "misc/random.md" });
    expect(getTaskContext(task, defaultFolders)).toBe("Other");
  });

  it("returns Other for root-level files", () => {
    const task = createMockTask({ path: "some-file.md" });
    expect(getTaskContext(task, defaultFolders)).toBe("Other");
  });

  it("respects custom folder settings", () => {
    const customFolders = {
      ...defaultFolders,
      projects: "work/projects",
      people: "contacts",
      meetingsRecurringEvents: "my/recurring-events",
    };
    const projectTask = createMockTask({ path: "work/projects/Foo.md" });
    const personTask = createMockTask({ path: "contacts/Alice.md" });
    const recurringEventTask = createMockTask({ path: "my/recurring-events/StandUp/2024-01-15.md" });
    expect(getTaskContext(projectTask, customFolders as FolderSettings)).toBe("Project");
    expect(getTaskContext(personTask, customFolders as FolderSettings)).toBe("Person");
    expect(getTaskContext(recurringEventTask, customFolders as FolderSettings)).toBe("Recurring Meeting");
    // Default paths no longer match
    expect(getTaskContext(createMockTask({ path: "projects/Foo.md" }), customFolders as FolderSettings)).toBe("Other");
    expect(getTaskContext(createMockTask({ path: "meetings/recurring-events/StandUp/2024-01-15.md" }), customFolders as FolderSettings)).toBe("Other");
  });
});

// ─── getTaskPriority ──────────────────────────────────────────────────────

describe("getTaskPriority", () => {
  it("returns 1 (Urgent) for ⏫ emoji", () => {
    const task = createMockTask({ path: "inbox/t.md", text: "Urgent task ⏫" });
    expect(getTaskPriority(task)).toBe(1);
  });

  it("returns 2 (High) for 🔼 emoji", () => {
    const task = createMockTask({ path: "inbox/t.md", text: "High task 🔼" });
    expect(getTaskPriority(task)).toBe(2);
  });

  it("returns 4 (Low) for 🔽 emoji", () => {
    const task = createMockTask({ path: "inbox/t.md", text: "Low task 🔽" });
    expect(getTaskPriority(task)).toBe(4);
  });

  it("returns 3 (DEFAULT_PRIORITY fallback) for ⏬ emoji (unmapped since priority 5 removed)", () => {
    const task = createMockTask({ path: "inbox/t.md", text: "Someday task ⏬" });
    expect(getTaskPriority(task)).toBe(3);
  });

  it("defaults to 3 (Medium) when no priority emoji present", () => {
    const task = createMockTask({ path: "inbox/t.md", text: "Regular task" });
    expect(getTaskPriority(task)).toBe(3);
  });

  it("defaults to 3 for empty text", () => {
    const task = createMockTask({ path: "inbox/t.md", text: "" });
    expect(getTaskPriority(task)).toBe(3);
  });
});

// ─── cleanTaskText ────────────────────────────────────────────────────────

describe("cleanTaskText", () => {
  it("strips priority emojis", () => {
    expect(cleanTaskText("Do the thing ⏫")).toBe("Do the thing");
    expect(cleanTaskText("Do the thing 🔼")).toBe("Do the thing");
    expect(cleanTaskText("Do the thing 🔽")).toBe("Do the thing");
    expect(cleanTaskText("Do the thing ⏬")).toBe("Do the thing");
  });

  it("strips due date with emoji and date", () => {
    expect(cleanTaskText("Task 📅 2024-01-15")).toBe("Task");
  });

  it("strips completion date with emoji", () => {
    expect(cleanTaskText("Task ✅ 2024-01-15")).toBe("Task");
  });

  it("strips recurrence emoji and text", () => {
    expect(cleanTaskText("Task 🔁 every day")).toBe("Task");
  });

  it("trims whitespace after stripping", () => {
    expect(cleanTaskText("  My Task  ")).toBe("My Task");
  });

  it("returns plain text unchanged", () => {
    expect(cleanTaskText("Normal task text")).toBe("Normal task text");
  });

  it("handles combined metadata", () => {
    const text = "Important task ⏫ 📅 2024-03-15";
    expect(cleanTaskText(text)).toBe("Important task");
  });
});

// ─── extractEmojiDate ─────────────────────────────────────────────────────

describe("extractEmojiDate", () => {
  it("extracts date after the given emoji", () => {
    expect(extractEmojiDate("Task 📅 2024-01-15", "📅")).toBe("2024-01-15");
  });

  it("returns null when emoji is not in text", () => {
    expect(extractEmojiDate("Task without date", "📅")).toBeNull();
  });

  it("returns null when no date follows the emoji", () => {
    expect(extractEmojiDate("Task 📅", "📅")).toBeNull();
  });

  it("extracts date after completion emoji", () => {
    expect(extractEmojiDate("Task ✅ 2024-02-20", "✅")).toBe("2024-02-20");
  });

  it("ignores text after date", () => {
    expect(extractEmojiDate("Task 📅 2024-01-15 more text", "📅")).toBe("2024-01-15");
  });

  it("returns null for empty string", () => {
    expect(extractEmojiDate("", "📅")).toBeNull();
  });
});

// ─── addDays ──────────────────────────────────────────────────────────────

describe("addDays", () => {
  it("adds positive days correctly", () => {
    expect(addDays("2024-01-01", 7)).toBe("2024-01-08");
  });

  it("adds 1 day correctly", () => {
    expect(addDays("2024-01-31", 1)).toBe("2024-02-01");
  });

  it("returns the same date when days is 0", () => {
    expect(addDays("2024-06-15", 0)).toBe("2024-06-15");
  });

  it("handles month boundary correctly", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29"); // 2024 is leap year
  });

  it("handles year boundary correctly", () => {
    expect(addDays("2023-12-31", 1)).toBe("2024-01-01");
  });
});

// ─── getParentRecurringMeetingPath ────────────────────────────────────────

describe("getParentRecurringMeetingPath", () => {
  it("returns correct path when recurring-meeting frontmatter is a wikilink", () => {
    const dv = createMockDataviewApi([
      {
        path: "meetings/recurring-events/StandUp/2024-01-15.md",
        frontmatter: { "recurring-meeting": "[[StandUp]]" },
      },
    ]);
    const result = getParentRecurringMeetingPath(
      "meetings/recurring-events/StandUp/2024-01-15.md",
      dv,
      "meetings/recurring"
    );
    expect(result).toBe("meetings/recurring/StandUp.md");
  });

  it("returns null when recurring-meeting frontmatter is absent", () => {
    const dv = createMockDataviewApi([
      { path: "meetings/recurring-events/StandUp/2024-01-15.md" },
    ]);
    const result = getParentRecurringMeetingPath(
      "meetings/recurring-events/StandUp/2024-01-15.md",
      dv,
      "meetings/recurring"
    );
    expect(result).toBeNull();
  });

  it("returns null when dv.page() returns null", () => {
    const dv = createMockDataviewApi([]);
    const result = getParentRecurringMeetingPath(
      "meetings/recurring-events/StandUp/2024-01-15.md",
      dv,
      "meetings/recurring"
    );
    expect(result).toBeNull();
  });
});
