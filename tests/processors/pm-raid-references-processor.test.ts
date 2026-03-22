import { describe, it, expect, vi } from "vitest";
import { registerPmRaidReferencesProcessor } from "@/processors/pm-raid-references-processor";
import { TFile } from "../mocks/obsidian-mock";
import type { RaidProcessorServices } from "@/services/interfaces";

// ─── Mock services factory ────────────────────────────────────────────────

interface MockFile {
  path: string;
  content: string;
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
  const fileMap = new Map<string, TFile>([[sourcePath, sourceFile], ...backlinks.map((b) => [b.path, new TFile(b.path)] as [string, TFile])]);
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
  frontmatter: Record<string, unknown> = { "raid-type": "Risk" }
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

  getHandler()("", el, ctx);

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
});
