import { describe, it, expect } from "vitest";
import { compareByFileName } from "@/utils/sort-utils";
import { createMockPage } from "../mocks/dataview-mock";

const page = (name: string) => createMockPage({ path: `clients/${name}.md` });

describe("compareByFileName", () => {
  it("orders pages alphabetically by file name", () => {
    const pages = [page("Globex"), page("Acme"), page("Northwind")];

    expect([...pages].sort(compareByFileName).map((p) => p.file.name)).toEqual(["Acme", "Globex", "Northwind"]);
  });

  it("returns a negative number when the first name sorts first, positive when it sorts last", () => {
    expect(compareByFileName(page("Acme"), page("Globex"))).toBeLessThan(0);
    expect(compareByFileName(page("Globex"), page("Acme"))).toBeGreaterThan(0);
  });

  it("returns 0 for equal names", () => {
    expect(compareByFileName(page("Acme"), page("Acme"))).toBe(0);
  });

  it("is also available through the utils barrel", async () => {
    const utils = await import("@/utils");
    expect(utils.compareByFileName).toBe(compareByFileName);
  });
});
