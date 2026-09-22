import { describe, it, expect } from "vitest";
import { RaidQuery } from "@/services/raid-query";
import { createMockDataviewApi } from "../mocks/dataview-mock";
import type { DataviewApi } from "@/types";

function raidQuery(dv: DataviewApi | null): RaidQuery {
  return new RaidQuery(() => dv);
}

describe("RaidQuery", () => {
  it("returns no items when Dataview is unavailable", () => {
    expect(raidQuery(null).resolve()).toEqual([]);
  });

  it("returns every #raid item regardless of status, and no non-RAID pages", () => {
    const dv = createMockDataviewApi([
      { path: "raid/R1.md", tags: ["#raid"], frontmatter: { status: "Open", "raised-date": "2024-01-01" } },
      { path: "raid/R2.md", tags: ["#raid"], frontmatter: { status: "Closed", "raised-date": "2024-01-02" } },
      { path: "projects/P.md", tags: ["#project"], frontmatter: {} },
    ]);
    const names = raidQuery(dv).resolve().map((p) => p.file.name);
    expect(names).toHaveLength(2);
    expect(names).toEqual(expect.arrayContaining(["R1", "R2"]));
  });

  it("sorts by raised-date descending", () => {
    const dv = createMockDataviewApi([
      { path: "raid/Old.md", tags: ["#raid"], frontmatter: { "raised-date": "2024-01-01" } },
      { path: "raid/Newest.md", tags: ["#raid"], frontmatter: { "raised-date": "2024-03-01" } },
      { path: "raid/Middle.md", tags: ["#raid"], frontmatter: { "raised-date": "2024-02-01" } },
    ]);
    expect(raidQuery(dv).resolve().map((p) => p.file.name)).toEqual(["Newest", "Middle", "Old"]);
  });
});
