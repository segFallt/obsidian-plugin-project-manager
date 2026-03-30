import { describe, it, expect, vi } from "vitest";
import { EntityCreationService } from "../../src/services/entity-creation-service";
import { TemplateService } from "../../src/services/template-service";
import { createMockApp, TFile } from "../mocks/app-mock";
import { DEFAULT_SETTINGS } from "../../src/settings";
import type { INavigationService } from "../../src/services/interfaces";

function createSvc(existingFiles: Parameters<typeof createMockApp>[0] = []) {
  const app = createMockApp(existingFiles);
  const templates = new TemplateService();
  const navigation: INavigationService = { openFile: vi.fn().mockResolvedValue(undefined) };
  const svc = new EntityCreationService(
    app as unknown as import("obsidian").App,
    DEFAULT_SETTINGS,
    templates,
    navigation
  );
  return { svc, app, navigation };
}

describe("EntityCreationService — createReferenceTopic", () => {
  it("creates file at the configured referenceTopics folder path", async () => {
    const { svc, app } = createSvc();
    const paths: string[] = [];
    app.vault.create = async (p) => { paths.push(p); return new TFile(p); };
    await svc.createReferenceTopic("Architecture");
    expect(paths[0]).toBe(`${DEFAULT_SETTINGS.folders.referenceTopics}/Architecture.md`);
  });

  it("opens the file after creation", async () => {
    const { svc, navigation } = createSvc();
    await svc.createReferenceTopic("Security");
    expect(navigation.openFile).toHaveBeenCalledOnce();
  });

  it("returns the created TFile", async () => {
    const { svc } = createSvc();
    const result = await svc.createReferenceTopic("Compliance");
    expect(result).toBeInstanceOf(TFile);
    expect(result.basename).toBe("Compliance");
  });
});

describe("EntityCreationService — createReferenceTopic with parent", () => {
  it("calls processFrontMatter and sets fm[\"parent\"] to the wikilink when parentName is provided", async () => {
    const { svc, app } = createSvc();
    const mutations: Record<string, unknown> = {};
    app.fileManager.processFrontMatter = async (_f, fn) => {
      const fm: Record<string, unknown> = {};
      fn(fm);
      Object.assign(mutations, fm);
    };
    await svc.createReferenceTopic("Kubernetes", "Cloud");
    expect(Object.prototype.hasOwnProperty.call(mutations, "parent")).toBe(true);
    expect(mutations.parent).toBe("[[Cloud]]");
  });

  it("does NOT call processFrontMatter for parent when parentName is undefined", async () => {
    const { svc, app } = createSvc();
    const processFrontMatterSpy = vi.spyOn(app.fileManager, "processFrontMatter");
    await svc.createReferenceTopic("Architecture");
    // processFrontMatter should not be called at all (no parent to set)
    expect(processFrontMatterSpy).not.toHaveBeenCalled();
  });
});

describe("EntityCreationService — createReference", () => {
  it("creates file at the configured references folder path", async () => {
    const { svc, app } = createSvc();
    const paths: string[] = [];
    app.vault.create = async (p) => { paths.push(p); return new TFile(p); };
    await svc.createReference("RFC-001 Auth Flow", ["[[Architecture]]"]);
    expect(paths[0]).toBe(`${DEFAULT_SETTINGS.folders.references}/RFC-001 Auth Flow.md`);
  });

  it("writes topics array via processFrontMatter (NOT via template)", async () => {
    const { svc, app } = createSvc();
    const mutations: Record<string, unknown> = {};
    app.fileManager.processFrontMatter = async (_f, fn) => {
      const fm: Record<string, unknown> = {};
      fn(fm);
      Object.assign(mutations, fm);
    };
    await svc.createReference("RFC-001 Auth Flow", ["[[Architecture]]", "[[Security]]"]);
    expect(Array.isArray(mutations.topics)).toBe(true);
    expect(mutations.topics).toEqual(["[[Architecture]]", "[[Security]]"]);
  });

  it("writes client wikilink via processFrontMatter when provided", async () => {
    const { svc, app } = createSvc();
    const mutations: Record<string, unknown> = {};
    app.fileManager.processFrontMatter = async (_f, fn) => {
      const fm: Record<string, unknown> = {};
      fn(fm);
      Object.assign(mutations, fm);
    };
    await svc.createReference("RFC-001 Auth Flow", ["[[Architecture]]"], "AcmeCo");
    expect(String(mutations.client ?? "")).toContain("AcmeCo");
  });

  it("writes engagement wikilink via processFrontMatter when provided", async () => {
    const { svc, app } = createSvc();
    const mutations: Record<string, unknown> = {};
    app.fileManager.processFrontMatter = async (_f, fn) => {
      const fm: Record<string, unknown> = {};
      fn(fm);
      Object.assign(mutations, fm);
    };
    await svc.createReference("RFC-001 Auth Flow", ["[[Architecture]]"], undefined, "AcmeCo Retainer");
    expect(String(mutations.engagement ?? "")).toContain("AcmeCo Retainer");
  });

  it("omits client frontmatter key when client not provided", async () => {
    const { svc, app } = createSvc();
    const mutations: Record<string, unknown> = {};
    app.fileManager.processFrontMatter = async (_f, fn) => {
      const fm: Record<string, unknown> = {};
      fn(fm);
      Object.assign(mutations, fm);
    };
    await svc.createReference("RFC-001 Auth Flow", ["[[Architecture]]"]);
    expect(Object.prototype.hasOwnProperty.call(mutations, "client")).toBe(false);
  });

  it("omits engagement frontmatter key when engagement not provided", async () => {
    const { svc, app } = createSvc();
    const mutations: Record<string, unknown> = {};
    app.fileManager.processFrontMatter = async (_f, fn) => {
      const fm: Record<string, unknown> = {};
      fn(fm);
      Object.assign(mutations, fm);
    };
    await svc.createReference("RFC-001 Auth Flow", ["[[Architecture]]"]);
    expect(Object.prototype.hasOwnProperty.call(mutations, "engagement")).toBe(false);
  });

  it("opens the file after creation", async () => {
    const { svc, navigation } = createSvc();
    await svc.createReference("RFC-001 Auth Flow", ["[[Architecture]]"]);
    expect(navigation.openFile).toHaveBeenCalledOnce();
  });
});
