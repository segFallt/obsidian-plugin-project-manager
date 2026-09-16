import { describe, it, expect } from "vitest";
import { EntityHierarchyService } from "@/services/entity-hierarchy-service";
import { createMockDataviewApi } from "../mocks/dataview-mock";
import { TFile } from "../mocks/app-mock";
import type { MockPageData } from "../mocks/dataview-mock";
import { DEFAULT_FOLDERS } from "@/constants";
import type { FolderSettings } from "@/settings";
import type { TFile as ObsidianTFile } from "obsidian";

const defaultFolders = DEFAULT_FOLDERS as unknown as FolderSettings;

function createHierarchy(pages: MockPageData[]) {
  const dv = createMockDataviewApi(pages);
  const svc = new EntityHierarchyService(() => dv, defaultFolders);
  return { svc, dv };
}

function nullHierarchy() {
  return new EntityHierarchyService(() => null, defaultFolders);
}

function asTFile(path: string): ObsidianTFile {
  return new TFile(path) as unknown as ObsidianTFile;
}

// ─── getEngagementForEntity ─────────────────────────────────────────────────

describe("EntityHierarchyService.getEngagementForEntity", () => {
  it("returns engagement via direct link", () => {
    const { svc } = createHierarchy([
      { path: "projects/Foo.md", frontmatter: { engagement: { path: "engagements/Eng1.md" } } },
      { path: "engagements/Eng1.md", frontmatter: { status: "Active" } },
    ]);
    const result = svc.getEngagementForEntity(asTFile("projects/Foo.md"));
    expect(result).not.toBeNull();
    expect(result?.file.name).toBe("Eng1");
  });

  it("returns null when file has no engagement", () => {
    const { svc } = createHierarchy([{ path: "inbox/Task.md", frontmatter: {} }]);
    expect(svc.getEngagementForEntity(asTFile("inbox/Task.md"))).toBeNull();
  });

  it("traverses parent project for project notes", () => {
    const { svc } = createHierarchy([
      { path: "projects/notes/foo/Note.md", frontmatter: { relatedProject: "Foo" } },
      { path: "projects/Foo.md", frontmatter: { engagement: "Eng1" } },
      { path: "engagements/Eng1.md", frontmatter: { status: "Active" } },
    ]);
    const result = svc.getEngagementForEntity(asTFile("projects/notes/foo/Note.md"));
    expect(result?.file.name).toBe("Eng1");
  });

  it("returns null when Dataview unavailable", () => {
    expect(nullHierarchy().getEngagementForEntity(asTFile("projects/Foo.md"))).toBeNull();
  });

  it("returns engagement via recurring meeting event chain", () => {
    const { svc } = createHierarchy([
      { path: "meetings/recurring-events/StandUp/2024-03-01.md", frontmatter: { "recurring-meeting": "[[StandUp]]" } },
      { path: "meetings/recurring/StandUp.md", frontmatter: { engagement: "Eng1" } },
      { path: "engagements/Eng1.md", frontmatter: { status: "Active" } },
    ]);
    const result = svc.getEngagementForEntity(asTFile("meetings/recurring-events/StandUp/2024-03-01.md"));
    expect(result?.file.name).toBe("Eng1");
  });

  it("returns null when recurring meeting event has no resolvable parent meeting", () => {
    const { svc } = createHierarchy([
      { path: "meetings/recurring-events/StandUp/2024-03-01.md", frontmatter: { "recurring-meeting": "[[StandUp]]" } },
    ]);
    expect(svc.getEngagementForEntity(asTFile("meetings/recurring-events/StandUp/2024-03-01.md"))).toBeNull();
  });
});

// ─── getClientForEntity ─────────────────────────────────────────────────────

describe("EntityHierarchyService.getClientForEntity", () => {
  it("returns client via direct link", () => {
    const { svc } = createHierarchy([
      { path: "engagements/Eng1.md", frontmatter: { client: { path: "clients/Acme.md" } } },
      { path: "clients/Acme.md", frontmatter: { status: "Active" } },
    ]);
    expect(svc.getClientForEntity(asTFile("engagements/Eng1.md"))?.file.name).toBe("Acme");
  });

  it("returns client through engagement chain", () => {
    const { svc } = createHierarchy([
      { path: "projects/Foo.md", frontmatter: { engagement: { path: "engagements/Eng1.md" } } },
      { path: "engagements/Eng1.md", frontmatter: { client: { path: "clients/Acme.md" } } },
      { path: "clients/Acme.md", frontmatter: { status: "Active" } },
    ]);
    expect(svc.getClientForEntity(asTFile("projects/Foo.md"))?.file.name).toBe("Acme");
  });

  it("returns null when no client in chain", () => {
    const { svc } = createHierarchy([{ path: "inbox/Task.md", frontmatter: {} }]);
    expect(svc.getClientForEntity(asTFile("inbox/Task.md"))).toBeNull();
  });

  it("returns null when Dataview unavailable", () => {
    expect(nullHierarchy().getClientForEntity(asTFile("engagements/Eng1.md"))).toBeNull();
  });
});

// ─── getParentProject ───────────────────────────────────────────────────────

describe("EntityHierarchyService.getParentProject", () => {
  it("returns parent project for a project note", () => {
    const { svc } = createHierarchy([
      { path: "projects/notes/foo/Note.md", frontmatter: { relatedProject: "Foo" } },
      { path: "projects/Foo.md", frontmatter: { status: "Active" } },
    ]);
    expect(svc.getParentProject(asTFile("projects/notes/foo/Note.md"))?.file.name).toBe("Foo");
  });

  it("returns null when file has no relatedProject", () => {
    const { svc } = createHierarchy([{ path: "projects/Foo.md", frontmatter: {} }]);
    expect(svc.getParentProject(asTFile("projects/Foo.md"))).toBeNull();
  });

  it("returns null when Dataview unavailable", () => {
    expect(nullHierarchy().getParentProject(asTFile("projects/notes/foo/Note.md"))).toBeNull();
  });
});

// ─── getEngagementNameForPath ───────────────────────────────────────────────

describe("EntityHierarchyService.getEngagementNameForPath", () => {
  it("returns engagement name via direct link", () => {
    const { svc } = createHierarchy([
      { path: "projects/Foo.md", frontmatter: { engagement: { path: "engagements/Eng1.md" } } },
      { path: "engagements/Eng1.md" },
    ]);
    expect(svc.getEngagementNameForPath("projects/Foo.md")).toBe("Eng1");
  });

  it("returns engagement name via relatedProject chain", () => {
    const { svc } = createHierarchy([
      { path: "projects/notes/foo/Note.md", frontmatter: { relatedProject: "Foo" } },
      { path: "projects/Foo.md", frontmatter: { engagement: "Eng1" } },
      { path: "engagements/Eng1.md" },
    ]);
    expect(svc.getEngagementNameForPath("projects/notes/foo/Note.md")).toBe("Eng1");
  });

  it("returns engagement name via recurring-meeting chain", () => {
    const { svc } = createHierarchy([
      { path: "meetings/recurring-events/StandUp/2024-03-01.md", frontmatter: { "recurring-meeting": "[[StandUp]]" } },
      { path: "meetings/recurring/StandUp.md", frontmatter: { engagement: "Eng1" } },
      { path: "engagements/Eng1.md" },
    ]);
    expect(svc.getEngagementNameForPath("meetings/recurring-events/StandUp/2024-03-01.md")).toBe("Eng1");
  });

  it("returns null when page has no engagement chain", () => {
    const { svc } = createHierarchy([{ path: "inbox/Task.md", frontmatter: {} }]);
    expect(svc.getEngagementNameForPath("inbox/Task.md")).toBeNull();
  });

  it("returns null for unknown path", () => {
    const { svc } = createHierarchy([]);
    expect(svc.getEngagementNameForPath("nonexistent.md")).toBeNull();
  });

  it("returns null when Dataview unavailable", () => {
    expect(nullHierarchy().getEngagementNameForPath("projects/Foo.md")).toBeNull();
  });
});

// ─── getClientFromEngagementLink ────────────────────────────────────────────

describe("EntityHierarchyService.getClientFromEngagementLink", () => {
  it("resolves client from engagement link", () => {
    const { svc } = createHierarchy([
      { path: "engagements/Eng1.md", frontmatter: { client: { path: "clients/Acme.md" } } },
      { path: "clients/Acme.md", frontmatter: { status: "Active" } },
    ]);
    expect(svc.getClientFromEngagementLink({ path: "engagements/Eng1.md" })).toBe("Acme");
  });

  it("returns null when engagement link is invalid", () => {
    const { svc } = createHierarchy([]);
    expect(svc.getClientFromEngagementLink(null)).toBeNull();
  });

  it("returns null when engagement page not found", () => {
    const { svc } = createHierarchy([]);
    expect(svc.getClientFromEngagementLink("[[NonExistent]]")).toBeNull();
  });

  it("returns null when Dataview unavailable", () => {
    expect(nullHierarchy().getClientFromEngagementLink("[[Eng1]]")).toBeNull();
  });
});

// ─── resolveClientName ──────────────────────────────────────────────────────

describe("EntityHierarchyService.resolveClientName", () => {
  it("returns the client name when page.client is a direct link", () => {
    const { svc, dv } = createHierarchy([
      { path: "raid/R1.md", tags: ["#raid"], frontmatter: { client: { path: "clients/Acme.md" } } },
    ]);
    expect(svc.resolveClientName(dv.page("raid/R1.md")!)).toBe("Acme");
  });

  it("returns the client name when page.client is a wikilink string", () => {
    const { svc, dv } = createHierarchy([
      { path: "raid/R1.md", tags: ["#raid"], frontmatter: { client: "[[Gamma Inc]]" } },
    ]);
    expect(svc.resolveClientName(dv.page("raid/R1.md")!)).toBe("Gamma Inc");
  });

  it("returns null when page has no client and no engagement", () => {
    const { svc, dv } = createHierarchy([
      { path: "raid/R1.md", tags: ["#raid"], frontmatter: {} },
    ]);
    expect(svc.resolveClientName(dv.page("raid/R1.md")!)).toBeNull();
  });

  it("resolves client via direct engagement → engagement.client chain", () => {
    const { svc, dv } = createHierarchy([
      { path: "raid/R1.md", tags: ["#raid"], frontmatter: { engagement: "[[Eng1]]" } },
      { path: "engagements/Eng1.md", tags: ["#engagement"], frontmatter: { client: "[[Acme]]" } },
    ]);
    expect(svc.resolveClientName(dv.page("raid/R1.md")!)).toBe("Acme");
  });

  it("regression: resolves client via relatedProject → project.engagement → engagement.client (multi-hop chain)", () => {
    const { svc, dv } = createHierarchy([
      { path: "projects/notes/my-proj/Note.md", frontmatter: { relatedProject: "[[My Project]]" } },
      { path: "projects/My Project.md", tags: ["#project"], frontmatter: { engagement: "[[Alpha Engagement]]" } },
      { path: "engagements/Alpha Engagement.md", tags: ["#engagement"], frontmatter: { client: "[[Delta Corp]]" } },
    ]);
    expect(svc.resolveClientName(dv.page("projects/notes/my-proj/Note.md")!)).toBe("Delta Corp");
  });

  it("returns null when engagement exists but engagement page has no client", () => {
    const { svc, dv } = createHierarchy([
      { path: "raid/R1.md", tags: ["#raid"], frontmatter: { engagement: "[[Eng1]]" } },
      { path: "engagements/Eng1.md", tags: ["#engagement"], frontmatter: {} },
    ]);
    expect(svc.resolveClientName(dv.page("raid/R1.md")!)).toBeNull();
  });

  it("folds the parent-project fallback: project note → parent project direct client, no engagement", () => {
    // The note has no client and no engagement; its parent project carries a
    // direct client but no engagement, so only the parent-project fallback
    // (recursing resolveClientName on the parent) surfaces the client.
    const { svc, dv } = createHierarchy([
      { path: "projects/notes/foo/Note.md", frontmatter: { relatedProject: "Foo" } },
      { path: "projects/Foo.md", tags: ["#project"], frontmatter: { client: { path: "clients/Acme.md" } } },
    ]);
    expect(svc.resolveClientName(dv.page("projects/notes/foo/Note.md")!)).toBe("Acme");
  });
});
