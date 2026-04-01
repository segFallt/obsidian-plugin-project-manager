import { describe, it, expect, vi } from "vitest";
import { registerPmRaidReferencesProcessor } from "@/processors/pm-raid-references-processor";
import { TFile, MarkdownRenderer } from "../mocks/obsidian-mock";
import type { RaidProcessorServices } from "@/services/interfaces";

// ─── Mock services factory ────────────────────────────────────────────────

interface MockFile {
  path: string;
  content: string;
  mtime?: number;
  ctime?: number;
}

function createMockServices(
  sourcePath = "raid/My Risk.md",
  backlinks: MockFile[] = [],
  frontmatter: Record<string, unknown> = {}
) {
  let registeredHandler:
    | ((
        source: string,
        el: HTMLElement,
        ctx: {
          addChild: (c: {
            render(): void | Promise<void>;
            onload?(): void;
            onunload?(): void;
            registerEvent?(ref: unknown): void;
          }) => void;
          sourcePath: string;
        }
      ) => void)
    | null = null;

  const vaultOn = vi.fn(() => ({ id: "mock-event" }));
  // Include the source file itself in the file map (so getAbstractFileByPath resolves it)
  const sourceFile = new TFile(sourcePath);
  const backlinkedFiles: [string, TFile][] = backlinks.map((b) => {
    const file = new TFile(b.path);
    if (b.mtime !== undefined) file.stat.mtime = b.mtime;
    if (b.ctime !== undefined) file.stat.ctime = b.ctime;
    return [b.path, file];
  });
  const fileMap = new Map<string, TFile>([[sourcePath, sourceFile], ...backlinkedFiles]);
  const contentMap = new Map(backlinks.map((b) => [b.path, b.content]));

  // Mock Dataview pages — return backlinks as DataviewPage-shaped objects
  const mockPages = backlinks.map((b) => ({
    file: { path: b.path, name: b.path.split("/").pop()?.replace(/\.md$/, "") ?? "" },
  }));

  const mockPlugin = {
    registerMarkdownCodeBlockProcessor: vi.fn((_lang: string, handler: typeof registeredHandler) => {
      registeredHandler = handler;
    }),
  };

  const services: RaidProcessorServices = {
    app: {
      vault: {
        on: vaultOn,
        read: vi.fn(async (file: TFile) => contentMap.get(file.path) ?? ""),
        getAbstractFileByPath: vi.fn((path: string) => fileMap.get(path) ?? null),
        getMarkdownFiles: vi.fn(() => [...fileMap.values()]),
      },
      metadataCache: {
        getFileCache: vi.fn((_file: TFile) => ({ frontmatter })),
      },
    } as unknown as RaidProcessorServices["app"],
    queryService: {
      dv: vi.fn(() => ({
        pages: vi.fn(() => ({ [Symbol.iterator]: () => mockPages[Symbol.iterator]() })),
      })),
      getActiveRaidItems: vi.fn(() => []),
    } as unknown as RaidProcessorServices["queryService"],
    loggerService: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as RaidProcessorServices["loggerService"],
  };

  return {
    services,
    mockPlugin,
    getHandler: () => registeredHandler!,
    sourcePath,
  };
}

// ─── Render helper ─────────────────────────────────────────────────────────

async function render(
  backlinks: MockFile[] = [],
  sourcePath = "raid/My Risk.md",
  frontmatter: Record<string, unknown> = { "raid-type": "Risk" },
  source = ""
) {
  const { services, mockPlugin, getHandler } = createMockServices(sourcePath, backlinks, frontmatter);

  registerPmRaidReferencesProcessor(
    mockPlugin as unknown as Parameters<typeof registerPmRaidReferencesProcessor>[0],
    services
  );

  const el = document.createElement("div");
  const children: Array<{
    render(): void | Promise<void>;
    onload?(): void;
    onunload?(): void;
    registerEvent?(ref: unknown): void;
  }> = [];

  const ctx = {
    addChild: (child: (typeof children)[0]) => {
      children.push(child);
    },
    sourcePath,
  };

  getHandler()(source, el, ctx);

  // Wait for async render to complete
  await new Promise((r) => setTimeout(r, 20));

  return { el, children };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("pm-raid-references processor", () => {
  it("registers a 'pm-raid-references' code block processor", () => {
    const { services, mockPlugin } = createMockServices();
    registerPmRaidReferencesProcessor(
      mockPlugin as unknown as Parameters<typeof registerPmRaidReferencesProcessor>[0],
      services
    );
    expect(mockPlugin.registerMarkdownCodeBlockProcessor).toHaveBeenCalledWith(
      "pm-raid-references",
      expect.any(Function)
    );
  });

  it("renders empty state when no references are found", async () => {
    const { el } = await render([], "raid/My Risk.md");
    const empty = el.querySelector(".raid-references-empty");
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain("No references yet");
  });

  it("renders reference cards when backlinks contain annotations", async () => {
    const raidItemName = "My Risk";
    const { el } = await render(
      [
        {
          path: "notes/Project Alpha.md",
          content: `We need to track this. {raid:positive}[[${raidItemName}]] The team agrees.`,
        },
      ],
      `raid/${raidItemName}.md`,
      { "raid-type": "Risk" }
    );

    // Should not show empty state
    expect(el.querySelector(".raid-references-empty")).toBeNull();

    // Should show a badge
    const badge = el.querySelector(".raid-badge--positive");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("Mitigates");
  });

  it("renders negative reference with correct label for Risk type", async () => {
    const raidItemName = "Payment Gateway Risk";
    const { el } = await render(
      [
        {
          path: "notes/Risk Analysis.md",
          content: `{raid:negative}[[${raidItemName}]] More problems found.`,
        },
      ],
      `raid/${raidItemName}.md`,
      { "raid-type": "Risk" }
    );

    const badge = el.querySelector(".raid-badge--negative");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("Escalates");
  });

  it("renders neutral reference with 'Notes' label", async () => {
    const raidItemName = "Scope Decision";
    const { el } = await render(
      [
        {
          path: "notes/Planning.md",
          content: `{raid:neutral}[[${raidItemName}]] Something noted here.`,
        },
      ],
      `raid/${raidItemName}.md`,
      { "raid-type": "Decision" }
    );

    const badge = el.querySelector(".raid-badge--neutral");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("Notes");
  });

  it("renders source note heading with internal link", async () => {
    const raidItemName = "My Assumption";
    const { el } = await render(
      [
        {
          path: "notes/Workshop Notes.md",
          content: `{raid:positive}[[${raidItemName}]] Confirmed by stakeholders.`,
        },
      ],
      `raid/${raidItemName}.md`,
      { "raid-type": "Assumption" }
    );

    const heading = el.querySelector("h4");
    expect(heading).not.toBeNull();
    const link = heading?.querySelector("a.internal-link");
    expect(link).not.toBeNull();
    expect(link?.textContent).toContain("Workshop Notes");
  });

  it("queries Dataview with unquoted link source [[ItemName]]", async () => {
    const raidItemName = "My Risk";
    const { services, mockPlugin, getHandler } = createMockServices(
      `raid/${raidItemName}.md`,
      [],
      { "raid-type": "Risk" }
    );

    // Replace dv with a stable mock so we can assert on the pages call
    const mockPagesFn = vi.fn(() => ({ [Symbol.iterator]: () => [][Symbol.iterator]() }));
    const dvInstance = { pages: mockPagesFn };
    (services.queryService.dv as ReturnType<typeof vi.fn>).mockReturnValue(dvInstance);

    registerPmRaidReferencesProcessor(
      mockPlugin as unknown as Parameters<typeof registerPmRaidReferencesProcessor>[0],
      services
    );

    const el = document.createElement("div");
    const ctx = {
      addChild: (child: { render(): void | Promise<void> }) => { void child.render(); },
      sourcePath: `raid/${raidItemName}.md`,
    };

    getHandler()("", el, ctx);
    await new Promise((r) => setTimeout(r, 20));

    expect(mockPagesFn).toHaveBeenCalledWith(`[[${raidItemName}]]`);
  });

  it("error boundary renders error when render throws", async () => {
    const { services, mockPlugin, getHandler } = createMockServices("raid/Bad Risk.md", []);

    // Force an error in queryService.dv()
    (services.queryService.dv as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("Dataview unavailable");
    });
    // Make getMarkdownFiles also fail — force the error boundary
    (services.app.vault as unknown as { getMarkdownFiles: ReturnType<typeof vi.fn> }).getMarkdownFiles
      .mockImplementation(() => { throw new Error("Vault error"); });

    registerPmRaidReferencesProcessor(
      mockPlugin as unknown as Parameters<typeof registerPmRaidReferencesProcessor>[0],
      services
    );

    const el = document.createElement("div");
    const ctx = {
      addChild: (child: { render(): void | Promise<void> }) => {
        void child.render();
      },
      sourcePath: "raid/Bad Risk.md",
    };

    getHandler()("", el, ctx);
    await new Promise((r) => setTimeout(r, 20));

    // Should render an error element
    const errorEl = el.querySelector(".pm-error");
    expect(errorEl).not.toBeNull();
  });

  it("renders source groups sorted by creation date, newest first", async () => {
    const raidItemName = "Sort Test Risk";
    const now = Date.now();
    const { el } = await render(
      [
        { path: "notes/Old Note.md", content: `{raid:positive}[[${raidItemName}]]`, mtime: now, ctime: now - 3000 },
        { path: "notes/New Note.md", content: `{raid:negative}[[${raidItemName}]]`, mtime: now - 3000, ctime: now },
        { path: "notes/Middle Note.md", content: `{raid:neutral}[[${raidItemName}]]`, mtime: now - 1000, ctime: now - 1000 },
      ],
      `raid/${raidItemName}.md`,
      { "raid-type": "Risk" },
      ""
    );

    const groups = el.querySelectorAll(".pm-raid-references__group");
    expect(groups).toHaveLength(3);

    const headings = [...groups].map((g) => g.querySelector("h4 a")?.textContent ?? "");
    expect(headings[0]).toContain("New Note");
    expect(headings[1]).toContain("Middle Note");
    expect(headings[2]).toContain("Old Note");
  });

  describe("configurable sort", () => {
    const raidItemName = "Sort Config Risk";
    const now = Date.now();

    // Helper that builds three files with distinct mtime and ctime values.
    // Old: mtime = now-3000, ctime = now-9000
    // Middle: mtime = now-1000, ctime = now-6000
    // New: mtime = now, ctime = now-3000
    const makeBacklinks = (): MockFile[] => [
      { path: "notes/Old Note.md", content: `{raid:positive}[[${raidItemName}]]`, mtime: now - 3000, ctime: now - 9000 },
      { path: "notes/New Note.md", content: `{raid:negative}[[${raidItemName}]]`, mtime: now, ctime: now - 3000 },
      { path: "notes/Middle Note.md", content: `{raid:neutral}[[${raidItemName}]]`, mtime: now - 1000, ctime: now - 6000 },
    ];

    it("modified-date desc (default) — newest mtime first", async () => {
      const { el } = await render(
        makeBacklinks(),
        `raid/${raidItemName}.md`,
        { "raid-type": "Risk" },
        "sort:\n  field: modified-date\n  direction: desc"
      );
      const headings = [...el.querySelectorAll(".pm-raid-references__group h4 a")].map(
        (a) => a.textContent ?? ""
      );
      expect(headings[0]).toContain("New Note");
      expect(headings[1]).toContain("Middle Note");
      expect(headings[2]).toContain("Old Note");
    });

    it("modified-date asc — oldest mtime first", async () => {
      const { el } = await render(
        makeBacklinks(),
        `raid/${raidItemName}.md`,
        { "raid-type": "Risk" },
        "sort:\n  field: modified-date\n  direction: asc"
      );
      const headings = [...el.querySelectorAll(".pm-raid-references__group h4 a")].map(
        (a) => a.textContent ?? ""
      );
      expect(headings[0]).toContain("Old Note");
      expect(headings[1]).toContain("Middle Note");
      expect(headings[2]).toContain("New Note");
    });

    it("created-date desc — newest ctime first", async () => {
      const { el } = await render(
        makeBacklinks(),
        `raid/${raidItemName}.md`,
        { "raid-type": "Risk" },
        "sort:\n  field: created-date\n  direction: desc"
      );
      const headings = [...el.querySelectorAll(".pm-raid-references__group h4 a")].map(
        (a) => a.textContent ?? ""
      );
      // ctime order: New Note (now-3000) > Middle Note (now-6000) > Old Note (now-9000)
      expect(headings[0]).toContain("New Note");
      expect(headings[1]).toContain("Middle Note");
      expect(headings[2]).toContain("Old Note");
    });

    it("created-date asc — oldest ctime first", async () => {
      const { el } = await render(
        makeBacklinks(),
        `raid/${raidItemName}.md`,
        { "raid-type": "Risk" },
        "sort:\n  field: created-date\n  direction: asc"
      );
      const headings = [...el.querySelectorAll(".pm-raid-references__group h4 a")].map(
        (a) => a.textContent ?? ""
      );
      // ctime order asc: Old Note (now-9000) < Middle Note (now-6000) < New Note (now-3000)
      expect(headings[0]).toContain("Old Note");
      expect(headings[1]).toContain("Middle Note");
      expect(headings[2]).toContain("New Note");
    });

    it("invalid field falls back to created-date desc — newest ctime first", async () => {
      const { el } = await render(
        makeBacklinks(),
        `raid/${raidItemName}.md`,
        { "raid-type": "Risk" },
        "sort:\n  field: bogus\n  direction: desc"
      );
      const headings = [...el.querySelectorAll(".pm-raid-references__group h4 a")].map(
        (a) => a.textContent ?? ""
      );
      expect(headings[0]).toContain("New Note");
      expect(headings[1]).toContain("Middle Note");
      expect(headings[2]).toContain("Old Note");
    });

    it("invalid direction falls back to desc — newest mtime first", async () => {
      const { el } = await render(
        makeBacklinks(),
        `raid/${raidItemName}.md`,
        { "raid-type": "Risk" },
        "sort:\n  field: modified-date\n  direction: bogus"
      );
      const headings = [...el.querySelectorAll(".pm-raid-references__group h4 a")].map(
        (a) => a.textContent ?? ""
      );
      expect(headings[0]).toContain("New Note");
      expect(headings[1]).toContain("Middle Note");
      expect(headings[2]).toContain("Old Note");
    });
  });

  it("wraps each source group heading and list in a .pm-raid-references__group div", async () => {
    const raidItemName = "Group Wrapper Risk";
    const now = Date.now();
    const { el } = await render(
      [
        { path: "notes/Note A.md", content: `{raid:positive}[[${raidItemName}]]`, mtime: now - 2000 },
        { path: "notes/Note B.md", content: `{raid:negative}[[${raidItemName}]]`, mtime: now - 1000 },
      ],
      `raid/${raidItemName}.md`,
      { "raid-type": "Risk" }
    );

    const groups = el.querySelectorAll(".pm-raid-references__group");
    expect(groups).toHaveLength(2);

    for (const group of groups) {
      const heading = group.querySelector("h4.pm-raid-references__group-heading");
      const list = group.querySelector("ul.pm-raid-references__list");
      expect(heading).not.toBeNull();
      expect(list).not.toBeNull();
      // heading and list must be direct children of the group wrapper
      expect(group.children[0]).toBe(heading);
      expect(group.children[1]).toBe(list);
    }

    // h4 elements must NOT be direct children of the outer container
    const container = el.querySelector(".pm-raid-references");
    expect(container).not.toBeNull();
    const directH4s = [...(container?.children ?? [])].filter((c) => c.tagName === "H4");
    expect(directH4s).toHaveLength(0);
  });

  it("renders annotation lineText via MarkdownRenderer (not plain textContent)", async () => {
    const raidItemName = "My Risk";
    const { el } = await render(
      [
        {
          path: "notes/Project Alpha.md",
          content: `{raid:positive}[[${raidItemName}]] **critical path** and [[Related Note]]`,
        },
      ],
      `raid/${raidItemName}.md`,
      { "raid-type": "Risk" }
    );

    const textDiv = el.querySelector(".pm-raid-references__item-text");
    expect(textDiv).not.toBeNull();
    // MarkdownRenderer.render sets innerHTML (mock wraps in <p>) — not a raw text node
    expect(textDiv?.innerHTML).toContain("**critical path**");
  });

  it("empty lineText produces no markdown container element", async () => {
    const raidItemName = "My Risk";
    const { el } = await render(
      [
        {
          // Annotation with nothing after it
          path: "notes/Empty Line.md",
          content: `{raid:positive}[[${raidItemName}]]`,
        },
      ],
      `raid/${raidItemName}.md`,
      { "raid-type": "Risk" }
    );

    const textDiv = el.querySelector(".pm-raid-references__item-text");
    expect(textDiv).toBeNull();
  });

  it("passes backlink file path (not RAID item path) as sourcePath to MarkdownRenderer", async () => {
    const raidItemName = "My Risk";
    const renderSpy = vi.spyOn(MarkdownRenderer, "render");

    await render(
      [
        {
          path: "notes/Project Alpha.md",
          content: `{raid:positive}[[${raidItemName}]] See [[Related Note]]`,
        },
      ],
      `raid/${raidItemName}.md`,
      { "raid-type": "Risk" }
    );

    expect(renderSpy).toHaveBeenCalledWith(
      expect.anything(),                // app
      expect.any(String),               // markdown string
      expect.any(HTMLElement),          // container element
      "notes/Project Alpha.md",        // sourcePath = backlink file path
      expect.anything()                 // component (this)
    );

    renderSpy.mockRestore();
  });

  it("whitespace-only lineText produces no markdown container element", async () => {
    const raidItemName = "My Risk";
    const { el } = await render(
      [
        {
          // Annotation with only whitespace after stripping the badge
          path: "notes/Whitespace Line.md",
          content: `{raid:positive}[[${raidItemName}]]   `,
        },
      ],
      `raid/${raidItemName}.md`,
      { "raid-type": "Risk" }
    );

    const textDiv = el.querySelector(".pm-raid-references__item-text");
    expect(textDiv).toBeNull();
  });
});
