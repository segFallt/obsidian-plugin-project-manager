import { describe, it, expect, vi } from "vitest";
import * as ObsidianModule from "obsidian";
import { registerPmReferencesProcessor } from "@/processors/pm-references-processor";
import type { ReferenceProcessorServices } from "@/plugin-context";
import type { DataviewPage } from "@/types";

// ─── Reference page factory ───────────────────────────────────────────────────

function makeReferencePage(overrides: Partial<{
  name: string;
  path: string;
  topics: unknown[];
  client: string;
  engagement: string;
}>): DataviewPage {
  const name = overrides.name ?? "My Reference";
  const path = overrides.path ?? `reference/references/${name}.md`;
  return {
    file: {
      name,
      path,
      folder: "reference/references",
      link: { path },
      tags: ["#reference"],
      mtime: { valueOf: () => Date.now(), toISO: () => new Date().toISOString() },
      tasks: {
        length: 0,
        values: [],
        where: vi.fn(),
        sort: vi.fn(),
        map: vi.fn(),
        filter: vi.fn(),
        [Symbol.iterator]: [][Symbol.iterator],
      } as unknown as DataviewPage["file"]["tasks"],
    },
    topics: overrides.topics ?? [],
    client: overrides.client ?? undefined,
    engagement: overrides.engagement ?? undefined,
  } as unknown as DataviewPage;
}

// ─── Mock services factory ────────────────────────────────────────────────────

function createMockServices(references: DataviewPage[] = []) {
  let registeredHandler:
    | ((
        source: string,
        el: HTMLElement,
        ctx: {
          addChild: (c: {
            render(): void;
            onload?(): void;
            onunload?(): void;
            registerEvent?(ref: unknown): void;
          }) => void;
          sourcePath: string;
        }
      ) => void)
    | null = null;

  const mockPlugin = {
    registerMarkdownCodeBlockProcessor: vi.fn(
      (
        _lang: string,
        handler: (
          source: string,
          el: HTMLElement,
          ctx: {
            addChild: (c: unknown) => void;
            sourcePath: string;
          }
        ) => void
      ) => {
        registeredHandler = handler as typeof registeredHandler;
      }
    ),
  };

  const sourcePath = "dashboard/references.md";

  const services: ReferenceProcessorServices = {
    app: {
      vault: {
        on: vi.fn(() => ({ id: "mock-event" })),
        getAbstractFileByPath: vi.fn(() => null),
      },
      metadataCache: {
        getFileCache: vi.fn(() => null),
      },
      fileManager: {
        processFrontMatter: vi.fn(
          async (_file: unknown, callback: (fm: Record<string, unknown>) => void) => {
            callback({});
          }
        ),
      },
      commands: {
        executeCommandById: vi.fn(),
      },
    } as unknown as ReferenceProcessorServices["app"],
    settings: {
      ui: {
        referenceDashboardFilters: {} as Record<string, unknown>,
      },
    } as unknown as ReferenceProcessorServices["settings"],
    queryService: {
      getReferences: vi.fn(() => references),
      getActiveEntitiesByTag: vi.fn(() => []),
      getClientFromEngagementLink: vi.fn(() => null),
      getReferenceTopicTree: vi.fn(() => []),
      getTopicDescendants: vi.fn(() => []),
    } as unknown as ReferenceProcessorServices["queryService"],
    loggerService: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ReferenceProcessorServices["loggerService"],
    saveSettings: vi.fn(async () => undefined),
  };

  return {
    mockPlugin,
    services,
    sourcePath,
    getHandler: () => registeredHandler!,
  };
}

// ─── Render helper ────────────────────────────────────────────────────────────

function render(source: string, references: DataviewPage[] = []) {
  const mock = createMockServices(references);
  registerPmReferencesProcessor(
    mock.mockPlugin as unknown as import("obsidian").Plugin,
    mock.services
  );

  const el = document.createElement("div");
  const sourcePath = mock.sourcePath;
  const children: unknown[] = [];
  const ctx = {
    addChild: (child: unknown) => children.push(child),
    sourcePath,
  };

  mock.getHandler()(source, el, ctx);
  return {
    el,
    services: mock.services,
    saveSettings: mock.services.saveSettings as ReturnType<typeof vi.fn>,
    child: children[0] as {
      onload?(): void;
      onunload?(): void;
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("pm-references processor (summary card)", () => {
  it("registers a 'pm-references' code block processor", () => {
    const mock = createMockServices();
    registerPmReferencesProcessor(
      mock.mockPlugin as unknown as import("obsidian").Plugin,
      mock.services
    );
    expect(mock.mockPlugin.registerMarkdownCodeBlockProcessor).toHaveBeenCalledWith(
      "pm-references",
      expect.any(Function)
    );
  });

  it("renders a summary card container with the expected CSS class", () => {
    const { el } = render("");
    expect(el.querySelector(".pm-references-summary")).not.toBeNull();
  });

  it("renders the 'Reference Dashboard' heading", () => {
    const { el } = render("");
    const heading = el.querySelector("h3");
    expect(heading).not.toBeNull();
    expect(heading!.textContent).toBe("Reference Dashboard");
  });

  it("renders reference count text for 0 references", () => {
    const { el } = render("", []);
    const p = el.querySelector("p");
    expect(p).not.toBeNull();
    expect(p!.textContent).toBe("0 references in your vault");
  });

  it("renders reference count text for 1 reference (singular)", () => {
    const { el } = render("", [makeReferencePage({ name: "Ref A" })]);
    const p = el.querySelector("p");
    expect(p!.textContent).toBe("1 reference in your vault");
  });

  it("renders reference count text for multiple references", () => {
    const refs = [makeReferencePage({ name: "A" }), makeReferencePage({ name: "B" })];
    const { el } = render("", refs);
    const p = el.querySelector("p");
    expect(p!.textContent).toBe("2 references in your vault");
  });

  it("renders an 'Open Dashboard →' button", () => {
    const { el } = render("");
    const btn = el.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe("Open Dashboard →");
  });

  it("button has the expected CSS classes", () => {
    const { el } = render("");
    const btn = el.querySelector("button");
    expect(btn!.classList.contains("pm-references-summary__open-btn")).toBe(true);
    expect(btn!.classList.contains("mod-cta")).toBe(true);
  });

  it("clicking the button executes the open-reference-dashboard command", () => {
    const { el, services } = render("");
    const btn = el.querySelector("button") as HTMLButtonElement;
    btn.click();
    expect(
      (services.app.commands as { executeCommandById: ReturnType<typeof vi.fn> }).executeCommandById
    ).toHaveBeenCalledWith("project-manager:open-reference-dashboard");
  });

  it("parses valid YAML config without errors", () => {
    const { el } = render("viewMode: topic");
    expect(el.querySelector(".pm-references-summary")).not.toBeNull();
    expect(el.querySelector(".pm-error")).toBeNull();
  });

  it("renders error state for invalid YAML, not the summary card", () => {
    // The mock parseYaml is permissive and never throws, so we force the error
    // path by making parseYaml throw for this test only.
    const spy = vi.spyOn(ObsidianModule, "parseYaml").mockImplementationOnce(() => {
      throw new Error("bad YAML");
    });
    try {
      const { el } = render("bad: yaml: content");
      expect(el.querySelector(".pm-references-summary")).toBeNull();
      expect(el.querySelector(".pm-error")).not.toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("renders summary card with zero references for empty source", () => {
    const { el } = render("");
    expect(el.querySelector(".pm-references-summary")).not.toBeNull();
    expect(el.querySelector(".pm-error")).toBeNull();
    expect(el.querySelector("p")!.textContent).toBe("0 references in your vault");
  });

  it("uses topic filter when config.filter.topics is set", () => {
    const source = "filter:\n  topics:\n    - Technology";
    const { services } = render(source);
    expect(services.queryService.getReferences).toHaveBeenCalledWith({ topics: ["Technology"] });
  });

  it("uses empty filter when config.filter.topics is not set", () => {
    const { services } = render("viewMode: topic");
    expect(services.queryService.getReferences).toHaveBeenCalledWith({});
  });

  it("button click with filter.topics sets selectedNode, calls saveSettings, then executes command", async () => {
    const source = "filter:\n  topics:\n    - \"[[Technology]]\"";
    const { el, services, saveSettings } = render(source);
    const btn = el.querySelector("button") as HTMLButtonElement;

    btn.click();
    // Flush all pending microtasks so the async IIFE fully resolves.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(
      (services.settings.ui.referenceDashboardFilters as Record<string, unknown>).selectedNode
    ).toBe("Technology");
    expect(saveSettings).toHaveBeenCalledOnce();
    expect(
      (services.app.commands as { executeCommandById: ReturnType<typeof vi.fn> }).executeCommandById
    ).toHaveBeenCalledWith("project-manager:open-reference-dashboard");
    // saveSettings must be called before the command is executed
    const saveOrder = saveSettings.mock.invocationCallOrder[0];
    const cmdOrder = (
      services.app.commands as { executeCommandById: ReturnType<typeof vi.fn> }
    ).executeCommandById.mock.invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(cmdOrder);
  });

  it("button click with no filter.topics does not mutate selectedNode and still executes command", () => {
    const { el, services, saveSettings } = render("viewMode: topic");
    const initialFilters = { ...services.settings.ui.referenceDashboardFilters } as Record<string, unknown>;
    const btn = el.querySelector("button") as HTMLButtonElement;

    btn.click();

    expect(
      (services.settings.ui.referenceDashboardFilters as Record<string, unknown>).selectedNode
    ).toBe(initialFilters.selectedNode);
    expect(saveSettings).not.toHaveBeenCalled();
    expect(
      (services.app.commands as { executeCommandById: ReturnType<typeof vi.fn> }).executeCommandById
    ).toHaveBeenCalledWith("project-manager:open-reference-dashboard");
  });

  it("normalises wikilink topic name from [[Technology]] to Technology when setting selectedNode", async () => {
    const source = "filter:\n  topics:\n    - \"[[Technology]]\"";
    const { el, services } = render(source);
    const btn = el.querySelector("button") as HTMLButtonElement;

    btn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(
      (services.settings.ui.referenceDashboardFilters as Record<string, unknown>).selectedNode
    ).toBe("Technology");
  });
});
