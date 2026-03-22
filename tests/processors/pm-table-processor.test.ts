import { describe, it, expect, vi } from "vitest";
import { registerPmTableProcessor } from "../../src/processors/pm-table-processor";
import { createMockDataviewApi, createMockPage } from "../mocks/dataview-mock";
import { TFile } from "../mocks/obsidian-mock";
import type { PluginServices, RegisterProcessorFn } from "../../src/plugin-context";
import { DEFAULT_FOLDERS } from "../../src/constants";

function createMockServices(pages: Parameters<typeof createMockDataviewApi>[0] = []) {
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

  const registerProcessor: RegisterProcessorFn = vi.fn((lang, handler) => {
    registeredHandler = handler;
  });

  const services = {
    app,
    queryService,
    settings: { folders: DEFAULT_FOLDERS },
    loggerService: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  } as unknown as PluginServices;

  return {
    services,
    registerProcessor,
    queryService,
    dv,
    getHandler: () => registeredHandler!,
  };
}

function render(source: string, serviceOpts?: Parameters<typeof createMockServices>[0]) {
  const { services, registerProcessor, queryService, getHandler } = createMockServices(serviceOpts);
  registerPmTableProcessor(services, registerProcessor);

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
    const { services, registerProcessor } = createMockServices();
    registerPmTableProcessor(services, registerProcessor);
    expect(registerProcessor).toHaveBeenCalledWith("pm-table", expect.any(Function));
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
      const { services, registerProcessor, queryService, getHandler } = createMockServices();
      registerPmTableProcessor(services, registerProcessor);

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

    it("renders notes table with mtime when notes exist (exercises .toISO() path)", () => {
      const { services, registerProcessor, queryService, getHandler } = createMockServices();
      registerPmTableProcessor(services, registerProcessor);

      const notes = [createMockPage({ path: "projects/notes/foo/Note1.md" })];
      queryService.getProjectNotes.mockReturnValue(notes);
      queryService.getMentions.mockReturnValue([]);

      const el = document.createElement("div");
      const ctx = {
        addChild: (child: { render: () => void }) => child.render(),
        sourcePath: "projects/Foo.md",
      };
      getHandler()("type: related-project-notes", el, ctx);

      const table = el.querySelector("table");
      expect(table).not.toBeNull();
      expect(el.innerHTML).toContain("Note1");
    });
  });

  describe("unknown type", () => {
    it("shows error for unknown table type", () => {
      const { el } = render("type: weird-unknown-type");
      expect(el.querySelector(".pm-error")).not.toBeNull();
    });
  });
});
