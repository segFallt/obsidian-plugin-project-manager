import { describe, it, expect, vi } from "vitest";
import { EntityHierarchyService } from "@/services/entity-hierarchy-service";
import type { DataviewPage } from "@/types";

// ─── Mock helpers ─────────────────────────────────────────────────────────

function makeQueryService(overrides: Partial<{
  resolveClientName: (page: DataviewPage) => string | null;
  getEngagementNameForPath: (path: string) => string | null;
}> = {}) {
  return {
    resolveClientName: overrides.resolveClientName ?? vi.fn(() => null),
    getEngagementNameForPath: overrides.getEngagementNameForPath ?? vi.fn(() => null),
  } as unknown as import("@/services/interfaces").IQueryService;
}

function makePage(overrides: Partial<{
  client: unknown;
  engagement: unknown;
  path: string;
}>): DataviewPage {
  const path = overrides.path ?? "raid/Some Item.md";
  return {
    file: {
      name: path.split("/").pop()?.replace(".md", "") ?? "item",
      path,
      folder: path.split("/").slice(0, -1).join("/"),
      link: { path },
      tags: [],
      mtime: { valueOf: () => Date.now(), toISO: () => new Date().toISOString() },
      tasks: { length: 0, values: [], where: vi.fn(), sort: vi.fn(), map: vi.fn(), filter: vi.fn(), [Symbol.iterator]: [][Symbol.iterator] } as unknown as DataviewPage["file"]["tasks"],
    },
    client: overrides.client,
    engagement: overrides.engagement,
  } as unknown as DataviewPage;
}

// ─── resolveClientName ────────────────────────────────────────────────────

describe("EntityHierarchyService.resolveClientName", () => {
  it("delegates to queryService.resolveClientName and returns its result", () => {
    const page = makePage({ path: "raid/R1.md" });
    const resolveClientName = vi.fn(() => "Acme Corp");
    const qs = makeQueryService({ resolveClientName });
    const svc = new EntityHierarchyService(qs);

    const result = svc.resolveClientName(page);

    expect(result).toBe("Acme Corp");
    expect(resolveClientName).toHaveBeenCalledWith(page);
  });

  it("returns null when queryService.resolveClientName returns null", () => {
    const page = makePage({ path: "inbox/Note.md" });
    const resolveClientName = vi.fn(() => null);
    const qs = makeQueryService({ resolveClientName });
    const svc = new EntityHierarchyService(qs);

    expect(svc.resolveClientName(page)).toBeNull();
    expect(resolveClientName).toHaveBeenCalledWith(page);
  });
});

// ─── resolveEngagementName ────────────────────────────────────────────────

describe("EntityHierarchyService.resolveEngagementName", () => {
  it("delegates to getEngagementNameForPath with the page file path", () => {
    const getEngagementNameForPath = vi.fn(() => "Alpha Engagement");
    const qs = makeQueryService({ getEngagementNameForPath });
    const svc = new EntityHierarchyService(qs);
    const page = makePage({ path: "projects/My Project.md" });

    const result = svc.resolveEngagementName(page);

    expect(result).toBe("Alpha Engagement");
    expect(getEngagementNameForPath).toHaveBeenCalledWith("projects/My Project.md");
  });

  it("returns null when getEngagementNameForPath returns null", () => {
    const qs = makeQueryService({ getEngagementNameForPath: vi.fn(() => null) });
    const svc = new EntityHierarchyService(qs);
    const page = makePage({ path: "inbox/Some Note.md" });

    expect(svc.resolveEngagementName(page)).toBeNull();
  });
});
