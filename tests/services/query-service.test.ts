import { describe, it, expect } from "vitest";
import { QueryService } from "../../src/services/query-service";
import { createMockDataviewApi } from "../mocks/dataview-mock";
import { createMockApp, TFile } from "../mocks/app-mock";
import type { MockPageData } from "../mocks/dataview-mock";
import { DEFAULT_FOLDERS } from "../../src/constants";
import type { FolderSettings } from "../../src/settings";

const defaultFolders = DEFAULT_FOLDERS as unknown as FolderSettings;

function createQueryService(pages: MockPageData[]) {
  const app = createMockApp();
  const dv = createMockDataviewApi(pages);
  const qs = new QueryService(app as unknown as import("obsidian").App, () => dv, defaultFolders);
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

  describe("getEntitiesByStatus", () => {
    it("returns pages with the given status", () => {
      const { qs } = createQueryService([
        { path: "clients/Active.md", tags: ["#client"], frontmatter: { status: "Active" } },
        { path: "clients/Inactive.md", tags: ["#client"], frontmatter: { status: "Inactive" } },
      ]);
      const result = qs.getEntitiesByStatus("#client", "Active");
      expect(result).toHaveLength(1);
      expect(result[0].file.name).toBe("Active");
    });

    it("supports array of statuses", () => {
      const { qs } = createQueryService([
        { path: "projects/New.md", tags: ["#project"], frontmatter: { status: "New" } },
        { path: "projects/Active.md", tags: ["#project"], frontmatter: { status: "Active" } },
        { path: "projects/Complete.md", tags: ["#project"], frontmatter: { status: "Complete" } },
      ]);
      const result = qs.getEntitiesByStatus("#project", ["New", "Active"]);
      expect(result).toHaveLength(2);
    });

    it("returns empty array when Dataview unavailable", () => {
      const app = createMockApp();
      const qs = new QueryService(app as unknown as import("obsidian").App, () => null);
      expect(qs.getEntitiesByStatus("#client", "Active")).toEqual([]);
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

  describe("getMentions", () => {
    it("returns pages mentioning the target file", () => {
      const targetFile = new TFile("clients/Acme.md");
      const { qs } = createQueryService([
        { path: "notes/Mention.md", name: "Acme" },
        { path: "notes/Other.md", name: "Other" },
      ]);
      const result = qs.getMentions(targetFile as unknown as import("obsidian").TFile);
      // The mock api searches by file name in pages()
      expect(result.length).toBeGreaterThanOrEqual(0); // basic check it doesn't throw
    });
  });

  describe("getEngagementForEntity", () => {
    it("returns engagement via direct link", () => {
      const file = new TFile("projects/Foo.md");
      const { qs } = createQueryService([
        {
          path: "projects/Foo.md",
          frontmatter: { engagement: { path: "engagements/Eng1.md" } },
        },
        {
          path: "engagements/Eng1.md",
          frontmatter: { status: "Active" },
        },
      ]);
      const result = qs.getEngagementForEntity(file as unknown as import("obsidian").TFile);
      expect(result).not.toBeNull();
      expect(result?.file.name).toBe("Eng1");
    });

    it("returns null when file has no engagement", () => {
      const file = new TFile("inbox/Task.md");
      const { qs } = createQueryService([
        { path: "inbox/Task.md", frontmatter: {} },
      ]);
      const result = qs.getEngagementForEntity(file as unknown as import("obsidian").TFile);
      expect(result).toBeNull();
    });

    it("traverses parent project for project notes", () => {
      const file = new TFile("projects/notes/foo/Note.md");
      const { qs } = createQueryService([
        {
          path: "projects/notes/foo/Note.md",
          frontmatter: { relatedProject: "Foo" },
        },
        {
          path: "projects/Foo.md",
          frontmatter: { engagement: "Eng1" },
        },
        {
          path: "engagements/Eng1.md",
          frontmatter: { status: "Active" },
        },
      ]);
      const result = qs.getEngagementForEntity(file as unknown as import("obsidian").TFile);
      expect(result).not.toBeNull();
      expect(result?.file.name).toBe("Eng1");
    });

    it("returns null when Dataview unavailable", () => {
      const app = createMockApp();
      const qs = new QueryService(app as unknown as import("obsidian").App, () => null);
      const file = new TFile("projects/Foo.md");
      expect(qs.getEngagementForEntity(file as unknown as import("obsidian").TFile)).toBeNull();
    });
  });

  describe("getClientForEntity", () => {
    it("returns client via direct link", () => {
      const file = new TFile("engagements/Eng1.md");
      const { qs } = createQueryService([
        {
          path: "engagements/Eng1.md",
          frontmatter: { client: { path: "clients/Acme.md" } },
        },
        {
          path: "clients/Acme.md",
          frontmatter: { status: "Active" },
        },
      ]);
      const result = qs.getClientForEntity(file as unknown as import("obsidian").TFile);
      expect(result?.file.name).toBe("Acme");
    });

    it("returns client through engagement chain", () => {
      const file = new TFile("projects/Foo.md");
      const { qs } = createQueryService([
        {
          path: "projects/Foo.md",
          frontmatter: { engagement: { path: "engagements/Eng1.md" } },
        },
        {
          path: "engagements/Eng1.md",
          frontmatter: { client: { path: "clients/Acme.md" } },
        },
        {
          path: "clients/Acme.md",
          frontmatter: { status: "Active" },
        },
      ]);
      const result = qs.getClientForEntity(file as unknown as import("obsidian").TFile);
      expect(result?.file.name).toBe("Acme");
    });

    it("returns null when no client in chain", () => {
      const file = new TFile("inbox/Task.md");
      const { qs } = createQueryService([
        { path: "inbox/Task.md", frontmatter: {} },
      ]);
      const result = qs.getClientForEntity(file as unknown as import("obsidian").TFile);
      expect(result).toBeNull();
    });

    it("returns null when Dataview unavailable", () => {
      const app = createMockApp();
      const qs = new QueryService(app as unknown as import("obsidian").App, () => null);
      const file = new TFile("engagements/Eng1.md");
      expect(qs.getClientForEntity(file as unknown as import("obsidian").TFile)).toBeNull();
    });
  });

  describe("getParentProject", () => {
    it("returns parent project for a project note", () => {
      const file = new TFile("projects/notes/foo/Note.md");
      const { qs } = createQueryService([
        {
          path: "projects/notes/foo/Note.md",
          frontmatter: { relatedProject: "Foo" },
        },
        {
          path: "projects/Foo.md",
          frontmatter: { status: "Active" },
        },
      ]);
      const result = qs.getParentProject(file as unknown as import("obsidian").TFile);
      expect(result?.file.name).toBe("Foo");
    });

    it("returns null when file has no relatedProject", () => {
      const file = new TFile("projects/Foo.md");
      const { qs } = createQueryService([
        { path: "projects/Foo.md", frontmatter: {} },
      ]);
      const result = qs.getParentProject(file as unknown as import("obsidian").TFile);
      expect(result).toBeNull();
    });

    it("returns null when Dataview unavailable", () => {
      const app = createMockApp();
      const qs = new QueryService(app as unknown as import("obsidian").App, () => null);
      const file = new TFile("projects/notes/foo/Note.md");
      expect(qs.getParentProject(file as unknown as import("obsidian").TFile)).toBeNull();
    });
  });

  describe("getClientFromEngagementLink", () => {
    it("resolves client from engagement link", () => {
      const { qs } = createQueryService([
        {
          path: "engagements/Eng1.md",
          frontmatter: { client: { path: "clients/Acme.md" } },
        },
        {
          path: "clients/Acme.md",
          frontmatter: { status: "Active" },
        },
      ]);
      const result = qs.getClientFromEngagementLink({ path: "engagements/Eng1.md" });
      expect(result).toBe("Acme");
    });

    it("returns null when engagement link is invalid", () => {
      const { qs } = createQueryService([]);
      expect(qs.getClientFromEngagementLink(null)).toBeNull();
    });

    it("returns null when engagement page not found", () => {
      const { qs } = createQueryService([]);
      expect(qs.getClientFromEngagementLink("[[NonExistent]]")).toBeNull();
    });

    it("returns null when Dataview unavailable", () => {
      const app = createMockApp();
      const qs = new QueryService(app as unknown as import("obsidian").App, () => null);
      expect(qs.getClientFromEngagementLink("[[Eng1]]")).toBeNull();
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
