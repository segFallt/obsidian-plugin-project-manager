import { describe, it, expect, vi } from "vitest";
import { registerPmTableProcessor } from "../../src/processors/pm-table-processor";
import { createMockDataviewApi, createMockPage } from "../mocks/dataview-mock";
import { TFile } from "../mocks/obsidian-mock";

function createMockPlugin(pages: Parameters<typeof createMockDataviewApi>[0] = []) {
  const dv = createMockDataviewApi(pages);

  const sourceFile = new TFile("clients/Acme.md");

  const app = {
    vault: {
      getAbstractFileByPath: vi.fn().mockReturnValue(sourceFile),
    },
    plugins: {
      plugins: {},
    },
  };

  const queryService = {
    dv: () => dv,
    getLinkedEntities: vi.fn().mockReturnValue([]),
    getProjectNotes: vi.fn().mockReturnValue([]),
    getMentions: vi.fn().mockReturnValue([]),
  };

  let registeredHandler: ((source: string, el: HTMLElement, ctx: unknown) => void) | null = null;

  const plugin = {
    app,
    queryService,
    registerMarkdownCodeBlockProcessor: vi.fn((lang, handler) => {
      registeredHandler = handler;
    }),
  };

  return {
    plugin: plugin as unknown as import("../../src/main").default,
    queryService,
    dv,
    getHandler: () => registeredHandler!,
  };
}

function render(source: string, pluginOpts?: Parameters<typeof createMockPlugin>[0]) {
  const { plugin, queryService, getHandler } = createMockPlugin(pluginOpts);
  registerPmTableProcessor(plugin);

  const el = document.createElement("div");
  const ctx = {
    addChild: (child: { render: () => void }) => child.render(),
    sourcePath: "clients/Acme.md",
  };

  getHandler()(source, el, ctx);
  return { el, queryService };
}

describe("pm-table processor", () => {
  it("registers a 'pm-table' code block processor", () => {
    const { plugin } = createMockPlugin();
    registerPmTableProcessor(plugin);
    expect(plugin.registerMarkdownCodeBlockProcessor).toHaveBeenCalledWith(
      "pm-table",
      expect.any(Function)
    );
  });

  it("shows error when type is missing", () => {
    const { el } = render("{}");
    expect(el.querySelector(".pm-error")).not.toBeNull();
  });

  describe("client-engagements", () => {
    it("shows 'No engagements found' when empty", () => {
      const { el, queryService } = render("type: client-engagements");
      queryService.getLinkedEntities.mockReturnValue([]);
      // getLinkedEntities is already empty from mock setup
      expect(el.innerHTML).toContain("No engagements found");
    });

    it("renders a table with engagements when data exists", () => {
      const { plugin, queryService, getHandler } = createMockPlugin();
      registerPmTableProcessor(plugin);

      const pages = [
        createMockPage({
          path: "engagements/Eng1.md",
          frontmatter: { status: "Active", "start-date": "2024-01-01" },
        }),
      ];
      queryService.getLinkedEntities.mockReturnValue(pages);

      const el = document.createElement("div");
      const ctx = {
        addChild: (child: { render: () => void }) => child.render(),
        sourcePath: "clients/Acme.md",
      };
      getHandler()("type: client-engagements", el, ctx);

      const table = el.querySelector("table");
      expect(table).not.toBeNull();
    });
  });

  describe("client-people", () => {
    it("shows 'No people found' when empty", () => {
      const { el } = render("type: client-people");
      expect(el.innerHTML).toContain("No people found");
    });
  });

  describe("engagement-projects", () => {
    it("shows 'No projects found' when empty", () => {
      const { el } = render("type: engagement-projects");
      expect(el.innerHTML).toContain("No projects found");
    });
  });

  describe("mentions", () => {
    it("shows 'No mentions found' when empty", () => {
      const { el } = render("type: mentions");
      expect(el.innerHTML).toContain("No mentions found");
    });
  });

  describe("related-project-notes", () => {
    it("shows 'No related notes' when empty", () => {
      const { el } = render("type: related-project-notes");
      expect(el.innerHTML).toContain("No related notes");
    });
  });

  describe("unknown type", () => {
    it("shows error for unknown table type", () => {
      const { el } = render("type: weird-unknown-type");
      expect(el.querySelector(".pm-error")).not.toBeNull();
    });
  });
});
