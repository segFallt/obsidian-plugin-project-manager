import { describe, it, expect, vi } from "vitest";
import { getFrontmatter, updateFrontmatter, getFrontmatterValue } from "../../src/utils/frontmatter-utils";
import { createMockApp, TFile } from "../mocks/app-mock";

describe("getFrontmatter", () => {
  it("returns frontmatter from metadata cache", () => {
    const file = new TFile("projects/Foo.md");
    const app = createMockApp([
      { path: "projects/Foo.md", frontmatter: { status: "Active", priority: 2 } },
    ]);
    const fm = getFrontmatter(app as unknown as import("obsidian").App, file as unknown as import("obsidian").TFile);
    expect(fm.status).toBe("Active");
    expect(fm.priority).toBe(2);
  });

  it("returns empty object when file has no frontmatter", () => {
    const file = new TFile("projects/Empty.md");
    const app = createMockApp([{ path: "projects/Empty.md" }]);
    const fm = getFrontmatter(app as unknown as import("obsidian").App, file as unknown as import("obsidian").TFile);
    expect(fm).toEqual({});
  });

  it("returns empty object when file has no cache entry", () => {
    const file = new TFile("nonexistent.md");
    const app = createMockApp([]);
    const fm = getFrontmatter(app as unknown as import("obsidian").App, file as unknown as import("obsidian").TFile);
    expect(fm).toEqual({});
  });

  it("returns a copy — mutations do not affect the cache", () => {
    const file = new TFile("projects/Foo.md");
    const app = createMockApp([
      { path: "projects/Foo.md", frontmatter: { status: "Active" } },
    ]);
    const fm = getFrontmatter(app as unknown as import("obsidian").App, file as unknown as import("obsidian").TFile);
    fm.status = "Mutated";
    // Re-read — cache should be unaffected
    const fm2 = getFrontmatter(app as unknown as import("obsidian").App, file as unknown as import("obsidian").TFile);
    expect(fm2.status).toBe("Active");
  });
});

describe("updateFrontmatter", () => {
  it("calls processFrontMatter with the mutator", async () => {
    const file = new TFile("projects/Foo.md");
    const app = createMockApp([{ path: "projects/Foo.md", frontmatter: { status: "New" } }]);
    const spy = vi.spyOn(app.fileManager, "processFrontMatter");

    await updateFrontmatter(
      app as unknown as import("obsidian").App,
      file as unknown as import("obsidian").TFile,
      (fm) => { fm["status"] = "Active"; }
    );

    expect(spy).toHaveBeenCalledOnce();
  });

  it("applies the mutation to the frontmatter", async () => {
    const file = new TFile("projects/Foo.md");
    const app = createMockApp([{ path: "projects/Foo.md", frontmatter: { status: "New" } }]);

    await updateFrontmatter(
      app as unknown as import("obsidian").App,
      file as unknown as import("obsidian").TFile,
      (fm) => { fm["status"] = "Active"; }
    );

    const fm = getFrontmatter(app as unknown as import("obsidian").App, file as unknown as import("obsidian").TFile);
    expect(fm.status).toBe("Active");
  });
});

describe("getFrontmatterValue", () => {
  it("returns the value for a known key", () => {
    const file = new TFile("clients/Acme.md");
    const app = createMockApp([
      { path: "clients/Acme.md", frontmatter: { status: "Active", priority: 1 } },
    ]);
    expect(
      getFrontmatterValue(
        app as unknown as import("obsidian").App,
        file as unknown as import("obsidian").TFile,
        "status"
      )
    ).toBe("Active");
  });

  it("returns undefined for a missing key", () => {
    const file = new TFile("clients/Acme.md");
    const app = createMockApp([{ path: "clients/Acme.md", frontmatter: {} }]);
    expect(
      getFrontmatterValue(
        app as unknown as import("obsidian").App,
        file as unknown as import("obsidian").TFile,
        "nonexistent"
      )
    ).toBeUndefined();
  });
});
