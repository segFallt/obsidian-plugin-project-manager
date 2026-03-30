import { describe, it, expect, vi, afterEach } from "vitest";
import { registerPmReferencesProcessor } from "@/processors/pm-references-processor";
import type { ReferenceProcessorServices } from "@/plugin-context";
import type { DataviewPage } from "@/types";
import { TFile } from "obsidian";

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

  const vaultOn = vi.fn(() => ({ id: "mock-event" }));

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
  const mockFile = new TFile(sourcePath);

  const processFrontMatter = vi.fn(
    async (_file: TFile, callback: (fm: Record<string, unknown>) => void) => {
      callback({});
    }
  );

  const services: ReferenceProcessorServices = {
    app: {
      vault: {
        on: vaultOn,
        getAbstractFileByPath: vi.fn(() => mockFile),
      },
      metadataCache: {
        getFileCache: vi.fn(() => null),
      },
      fileManager: {
        processFrontMatter,
      },
    } as unknown as ReferenceProcessorServices["app"],
    settings: {} as ReferenceProcessorServices["settings"],
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
  };

  return {
    mockPlugin,
    services,
    vaultOn,
    processFrontMatter,
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
    vaultOn: mock.vaultOn,
    processFrontMatter: mock.processFrontMatter,
    child: children[0] as {
      onload?(): void;
      onunload?(): void;
      isUpdating?: boolean;
    },
  };
}

// ─── Test isolation ───────────────────────────────────────────────────────────

afterEach(() => {
  vi.useRealTimers();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("pm-references processor", () => {
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

  it("renders the dashboard container", () => {
    const { el } = render("");
    expect(el.querySelector(".pm-references")).not.toBeNull();
  });

  it("renders the toolbar with view mode tabs", () => {
    const { el } = render("");
    const toolbar = el.querySelector(".pm-references__toolbar");
    expect(toolbar).not.toBeNull();
    const tabs = el.querySelectorAll(".pm-references__tab");
    expect(tabs.length).toBeGreaterThanOrEqual(3);
  });

  it("renders empty state message when no references exist", () => {
    const { el } = render("");
    const panel = el.querySelector(".pm-references__panel");
    expect(panel).not.toBeNull();
    expect(panel!.querySelector(".pm-ref-empty")).not.toBeNull();
    expect(panel!.textContent).toContain("No references found");
  });

  it("renders reference cards when references are available", () => {
    const refs = [
      makeReferencePage({ name: "Clean Architecture", topics: ["[[Architecture]]"] }),
    ];
    const { el } = render("", refs);
    const panel = el.querySelector(".pm-references__panel");
    expect(panel!.textContent).toContain("Clean Architecture");
  });

  it("renders collapsible groups for reference topics", () => {
    const refs = [
      makeReferencePage({ name: "Book A", topics: [{ path: "Architecture.md" }] }),
      makeReferencePage({ name: "Book B", topics: [{ path: "Architecture.md" }] }),
    ];
    const { el } = render("", refs);
    const groups = el.querySelectorAll(".pm-ref-group");
    expect(groups.length).toBeGreaterThan(0);
  });

  it("renders FilterChipSelect containers for topic, client, and engagement filters when filter panel is expanded", () => {
    const { el } = render("");
    const toggle = el.querySelector<HTMLButtonElement>(".pm-references__filters-toggle");
    expect(toggle).not.toBeNull();
    toggle!.click();
    const chipSelects = el.querySelectorAll(".pm-filter-chip-select");
    expect(chipSelects.length).toBe(3);
  });

  it("reads viewMode from config and activates the correct tab", () => {
    const { el } = render("viewMode: client");
    const activeTab = el.querySelector<HTMLButtonElement>(".pm-references__tab--active");
    expect(activeTab).not.toBeNull();
    expect(activeTab!.textContent).toBe("By Client");
  });

  describe("lifecycle", () => {
    it("onload registers vault modify event", () => {
      const { child, vaultOn } = render("");
      (child as { onload(): void }).onload();
      expect(vaultOn).toHaveBeenCalledWith("modify", expect.any(Function));
    });

    it("onunload clears debounce timers without throwing", () => {
      const { child } = render("");
      expect(() => (child as { onunload(): void }).onunload()).not.toThrow();
    });

    it("vault modify event triggers debounced refresh when isUpdating is false", async () => {
      vi.useFakeTimers();
      const { child, vaultOn } = render("");
      (child as { onload(): void }).onload();

      const modifyCallback = vaultOn.mock.calls[0][1] as () => void;
      modifyCallback();

      // Should not throw while timers are pending
      await vi.runAllTimersAsync();
    });
  });

  describe("filter persistence", () => {
    it("loads saved viewMode and selectedNode from frontmatter and activates the correct tab", () => {
      const mock = createMockServices();
      (mock.services.app.metadataCache.getFileCache as ReturnType<typeof vi.fn>).mockReturnValue({
        frontmatter: {
          "pm-references-filters": {
            viewMode: "engagement",
            selectedNode: "[[Kubernetes]]",
          },
        },
      });
      registerPmReferencesProcessor(
        mock.mockPlugin as unknown as import("obsidian").Plugin,
        mock.services
      );

      const el = document.createElement("div");
      const children: unknown[] = [];
      mock.getHandler()("", el, {
        addChild: (child: unknown) => children.push(child),
        sourcePath: mock.sourcePath,
      });

      const activeTab = el.querySelector<HTMLButtonElement>(".pm-references__tab--active");
      expect(activeTab).not.toBeNull();
      expect(activeTab!.textContent).toBe("By Engagement");
    });

    it("saves selectedNode to frontmatter after debounce when filters change via tab click", async () => {
      vi.useFakeTimers();

      // Pre-load a selectedNode in frontmatter so it is part of the persisted state
      const mock = createMockServices();
      (mock.services.app.metadataCache.getFileCache as ReturnType<typeof vi.fn>).mockReturnValue({
        frontmatter: {
          "pm-references-filters": {
            viewMode: "topic",
            selectedNode: "[[Kubernetes]]",
          },
        },
      });

      const savedStates: Array<Record<string, unknown>> = [];
      (mock.services.app.fileManager.processFrontMatter as ReturnType<typeof vi.fn>).mockImplementation(
        async (_file: TFile, callback: (fm: Record<string, unknown>) => void) => {
          const fm: Record<string, unknown> = {};
          callback(fm);
          savedStates.push(fm);
        }
      );

      registerPmReferencesProcessor(
        mock.mockPlugin as unknown as import("obsidian").Plugin,
        mock.services
      );

      const el = document.createElement("div");
      const children: unknown[] = [];
      mock.getHandler()("", el, {
        addChild: (child: unknown) => children.push(child),
        sourcePath: mock.sourcePath,
      });

      // Click the "By Client" tab to trigger a filter change
      const tabs = [...el.querySelectorAll<HTMLButtonElement>(".pm-references__tab")];
      const clientTab = tabs.find((t) => t.textContent === "By Client");
      expect(clientTab).not.toBeUndefined();
      clientTab!.click();

      // Not yet saved (debounced)
      expect(mock.services.app.fileManager.processFrontMatter).not.toHaveBeenCalled();

      await vi.runAllTimersAsync();

      expect(mock.services.app.fileManager.processFrontMatter).toHaveBeenCalled();

      // Switching view mode resets selectedNode to undefined
      const lastSaved = savedStates[savedStates.length - 1] as {
        "pm-references-filters": { selectedNode?: string; viewMode?: string };
      };
      expect(lastSaved["pm-references-filters"].viewMode).toBe("client");
      expect(lastSaved["pm-references-filters"].selectedNode).toBeUndefined();
    });
  });
});
