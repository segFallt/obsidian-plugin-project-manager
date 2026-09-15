import { describe, it, expect } from "vitest";
import { TaskQuery } from "@/services/entity-query";
import { createMockDataviewApi } from "../mocks/dataview-mock";
import { DEFAULT_FOLDERS } from "@/constants";
import type { DataviewApi } from "@/types";

const UTILITY = DEFAULT_FOLDERS.utility;

function taskQuery(dv: DataviewApi | null): TaskQuery {
  return new TaskQuery(
    () => dv,
    () => UTILITY
  );
}

describe("TaskQuery", () => {
  it("returns no items when Dataview is unavailable", () => {
    expect(taskQuery(null).resolve()).toEqual([]);
  });

  it("flat-maps every task across all pages", () => {
    const dv = createMockDataviewApi([
      { path: "projects/A.md", tasks: [{ text: "a1" }, { text: "a2" }] },
      { path: "projects/B.md", tasks: [{ text: "b1" }] },
    ]);
    const texts = taskQuery(dv).resolve().map((t) => t.text);
    expect(texts).toEqual(["a1", "a2", "b1"]);
  });

  it("excludes tasks under the utility folder", () => {
    const dv = createMockDataviewApi([
      { path: "projects/A.md", tasks: [{ text: "keep" }] },
      { path: `${UTILITY}/notes.md`, tasks: [{ text: "drop" }] },
    ]);
    const texts = taskQuery(dv).resolve().map((t) => t.text);
    expect(texts).toEqual(["keep"]);
  });

  it("returns an empty list when no pages have tasks", () => {
    const dv = createMockDataviewApi([{ path: "projects/A.md" }]);
    expect(taskQuery(dv).resolve()).toEqual([]);
  });
});
