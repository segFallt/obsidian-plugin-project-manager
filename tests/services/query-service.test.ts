import { describe, it, expect } from "vitest";
import { QueryService } from "../../src/services/query-service";
import { createMockDataviewApi } from "../mocks/dataview-mock";
import { createMockApp, TFile } from "../mocks/app-mock";
import type { MockPageData } from "../mocks/dataview-mock";

function createQueryService(pages: MockPageData[]) {
  const app = createMockApp();
  const dv = createMockDataviewApi(pages);
  const qs = new QueryService(app as unknown as import("obsidian").App, () => dv);
  return { qs, dv };
}

describe("QueryService", () => {
  describe("getEntitiesByTag", () => {
    it("returns pages matching a tag", () => {
      const { qs } = createQueryService([
        { path: "clients/Acme.md", tags: ["#client"], frontmatter: { status: "Active" } },
        { path: "projects/Foo.md", tags: ["#project"], frontmatter: { status: "New" } },
      ]);

      const result = qs.getEntitiesByTag("#client");
      expect(result).toHaveLength(1);
      expect(result[0].file.name).toBe("Acme");
    });

    it("returns empty array when no matching pages", () => {
      const { qs } = createQueryService([]);
      expect(qs.getEntitiesByTag("#client")).toHaveLength(0);
    });

    it("filters by folder when provided", () => {
      const { qs } = createQueryService([
        { path: "clients/Acme.md", folder: "clients", tags: ["#client"] },
        { path: "other/Acme.md", folder: "other", tags: ["#client"] },
      ]);

      const result = qs.getEntitiesByTag("#client", "clients");
      expect(result).toHaveLength(1);
      expect(result[0].file.folder).toBe("clients");
    });
  });

  describe("getActiveEntitiesByTag", () => {
    it("returns only active entities", () => {
      const { qs } = createQueryService([
        { path: "clients/Acme.md", tags: ["#client"], frontmatter: { status: "Active" } },
        { path: "clients/Old.md", tags: ["#client"], frontmatter: { status: "Inactive" } },
      ]);

      const result = qs.getActiveEntitiesByTag("#client");
      expect(result).toHaveLength(1);
      expect(result[0].file.name).toBe("Acme");
    });
  });

  describe("getLinkedEntities", () => {
    it("returns entities where property links to target file", () => {
      const targetFile = new TFile("clients/Acme.md");
      const { qs } = createQueryService([
        {
          path: "engagements/Eng1.md",
          folder: "engagements",
          tags: ["#engagement"],
          frontmatter: { client: { path: "clients/Acme.md" } },
        },
        {
          path: "engagements/Eng2.md",
          folder: "engagements",
          tags: ["#engagement"],
          frontmatter: { client: { path: "clients/Other.md" } },
        },
      ]);

      const result = qs.getLinkedEntities(
        "engagements",
        "#engagement",
        "client",
        targetFile as unknown as import("obsidian").TFile
      );
      expect(result).toHaveLength(1);
      expect(result[0].file.name).toBe("Eng1");
    });
  });

  describe("getProjectNotes", () => {
    it("returns pages with relatedProject linking to the project file", () => {
      const projectFile = new TFile("projects/My Project.md");
      const { qs } = createQueryService([
        {
          path: "projects/notes/my_project/Note1.md",
          frontmatter: { relatedProject: { path: "projects/My Project.md" } },
        },
        {
          path: "projects/notes/other/Note2.md",
          frontmatter: { relatedProject: { path: "projects/Other.md" } },
        },
      ]);

      const result = qs.getProjectNotes(projectFile as unknown as import("obsidian").TFile);
      expect(result).toHaveLength(1);
      expect(result[0].file.name).toBe("Note1");
    });
  });

  describe("getPage", () => {
    it("returns a page by path", () => {
      const { qs } = createQueryService([
        { path: "projects/Foo.md" },
      ]);

      const page = qs.getPage("projects/Foo.md");
      expect(page).not.toBeNull();
      expect(page?.file.name).toBe("Foo");
    });

    it("returns null for unknown path", () => {
      const { qs } = createQueryService([]);
      expect(qs.getPage("nonexistent.md")).toBeNull();
    });
  });

  describe("returns null when Dataview is unavailable", () => {
    it("getEntitiesByTag returns empty array", () => {
      const app = createMockApp();
      const qs = new QueryService(app as unknown as import("obsidian").App, () => null);
      expect(qs.getEntitiesByTag("#client")).toEqual([]);
    });
  });
});
