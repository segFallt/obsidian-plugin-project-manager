import { describe, it, expect, vi } from "vitest";
import { EntityHierarchyService } from "@/services/entity-hierarchy-service";
import type { DataviewPage } from "@/types";

// ─── Mock helpers ─────────────────────────────────────────────────────────

function makeQueryService(overrides: Partial<{
  getClientFromEngagementLink: (link: unknown) => string | null;
  getEngagementNameForPath: (path: string) => string | null;
}> = {}) {
  return {
    getClientFromEngagementLink: overrides.getClientFromEngagementLink ?? vi.fn(() => null),
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
  it("returns the client name directly when page.client is a DataviewLink", () => {
    const qs = makeQueryService();
    const svc = new EntityHierarchyService(qs);
    const page = makePage({ client: { path: "clients/Acme Corp.md" } });

    expect(svc.resolveClientName(page)).toBe("Acme Corp");
  });

  it("returns the client name directly when page.client is a plain string", () => {
    const qs = makeQueryService();
    const svc = new EntityHierarchyService(qs);
    const page = makePage({ client: "Beta Ltd" });

    expect(svc.resolveClientName(page)).toBe("Beta Ltd");
  });

  it("falls back via getEngagementNameForPath + getClientFromEngagementLink when page.client is absent but engagement is set", () => {
    // resolveClientName now delegates all traversal to getEngagementNameForPath rather
    // than reading page.engagement directly. The queryService mock simulates the case
    // where getEngagementNameForPath resolves the page's direct engagement field and
    // returns the engagement name; getClientFromEngagementLink then resolves to the client.
    const getEngagementNameForPath = vi.fn(() => "Project X");
    const getClientFromEngagementLink = vi.fn(() => "Gamma Inc");
    const qs = makeQueryService({ getEngagementNameForPath, getClientFromEngagementLink });
    const svc = new EntityHierarchyService(qs);
    const page = makePage({ engagement: { path: "engagements/Project X.md" } });

    const result = svc.resolveClientName(page);

    expect(result).toBe("Gamma Inc");
    expect(getEngagementNameForPath).toHaveBeenCalledWith(page.file.path);
    expect(getClientFromEngagementLink).toHaveBeenCalledWith("Project X");
  });

  it("returns null when both page.client and engagement are absent", () => {
    const qs = makeQueryService();
    const svc = new EntityHierarchyService(qs);
    const page = makePage({});

    expect(svc.resolveClientName(page)).toBeNull();
  });

  it("returns null when page.client is absent and getClientFromEngagementLink returns null", () => {
    const qs = makeQueryService({
      getClientFromEngagementLink: vi.fn(() => null),
    });
    const svc = new EntityHierarchyService(qs);
    const page = makePage({ engagement: { path: "engagements/Project Y.md" } });

    expect(svc.resolveClientName(page)).toBeNull();
  });

  it("does not call getClientFromEngagementLink when direct client is resolved", () => {
    const getClientFromEngagementLink = vi.fn(() => "Should Not Be Called");
    const qs = makeQueryService({ getClientFromEngagementLink });
    const svc = new EntityHierarchyService(qs);
    const page = makePage({ client: { path: "clients/Direct Client.md" }, engagement: { path: "engagements/Eng.md" } });

    svc.resolveClientName(page);

    expect(getClientFromEngagementLink).not.toHaveBeenCalled();
  });

  it("resolves client via getEngagementNameForPath for a project note (relatedProject chain)", () => {
    const getEngagementNameForPath = vi.fn(() => "Alpha Engagement");
    const getClientFromEngagementLink = vi.fn(() => "Delta Corp");
    const qs = makeQueryService({ getEngagementNameForPath, getClientFromEngagementLink });
    const svc = new EntityHierarchyService(qs);
    // Project note has no direct client or engagement field
    const page = makePage({ path: "projects/notes/my-note/Some Note.md" });

    const result = svc.resolveClientName(page);

    expect(result).toBe("Delta Corp");
    expect(getEngagementNameForPath).toHaveBeenCalledWith("projects/notes/my-note/Some Note.md");
    expect(getClientFromEngagementLink).toHaveBeenCalledWith("Alpha Engagement");
  });

  it("resolves client via getEngagementNameForPath for a recurring-meeting-event page", () => {
    const getEngagementNameForPath = vi.fn(() => "Beta Engagement");
    const getClientFromEngagementLink = vi.fn(() => "Sigma Ltd");
    const qs = makeQueryService({ getEngagementNameForPath, getClientFromEngagementLink });
    const svc = new EntityHierarchyService(qs);
    // Recurring meeting event has no direct client or engagement
    const page = makePage({ path: "meetings/recurring/Weekly Sync/2026-03-25.md" });

    const result = svc.resolveClientName(page);

    expect(result).toBe("Sigma Ltd");
    expect(getEngagementNameForPath).toHaveBeenCalledWith("meetings/recurring/Weekly Sync/2026-03-25.md");
  });

  it("returns null when getEngagementNameForPath returns null and no direct client", () => {
    const getEngagementNameForPath = vi.fn(() => null);
    const getClientFromEngagementLink = vi.fn(() => null);
    const qs = makeQueryService({ getEngagementNameForPath, getClientFromEngagementLink });
    const svc = new EntityHierarchyService(qs);
    const page = makePage({ path: "inbox/Some Note.md" });

    expect(svc.resolveClientName(page)).toBeNull();
    expect(getClientFromEngagementLink).not.toHaveBeenCalled();
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
