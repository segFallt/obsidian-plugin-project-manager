import { describe, it, expect, vi } from "vitest";
import { registerPmEntityViewProcessor } from "../../src/processors/pm-entity-view-processor";
import { createMockPage } from "../mocks/dataview-mock";
import { TFile } from "../mocks/obsidian-mock";
import type { PluginServices, RegisterProcessorFn } from "../../src/plugin-context";
import { DEFAULT_FOLDERS } from "../../src/constants";

// ─── Mock factory ────────────────────────────────────────────────────────────

function createMockServices(sourcePath = "clients/Acme.md") {
  const sourceFile = new TFile(sourcePath);

  const app = {
    vault: {
      getAbstractFileByPath: vi.fn().mockReturnValue(sourceFile),
    },
    commands: {
      executeCommandById: vi.fn(),
    },
  };

  const queryService = {
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
    pendingActionContext: null as { field: string; value: string } | null,
    loggerService: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
  } as unknown as PluginServices;

  return {
    services,
    registerProcessor,
    queryService,
    app,
    getHandler: () => registeredHandler!,
  };
}

function render(
  source: string,
  sourcePath = "clients/Acme.md",
  opts?: { queryService?: Partial<ReturnType<typeof createMockServices>["queryService"]> }
) {
  const mocks = createMockServices(sourcePath);
  if (opts?.queryService) {
    Object.assign(mocks.queryService, opts.queryService);
  }
  registerPmEntityViewProcessor(mocks.services, mocks.registerProcessor);

  const el = document.createElement("div");
  const ctx = {
    addChild: (child: { render: () => void }) => child.render(),
    sourcePath,
  };
  mocks.getHandler()(source, el, ctx);
  return { el, queryService: mocks.queryService, services: mocks.services };
}

// ─── Registration ─────────────────────────────────────────────────────────────

describe("pm-entity-view processor", () => {
  it("registers a 'pm-entity-view' code block processor", () => {
    const { services, registerProcessor } = createMockServices();
    registerPmEntityViewProcessor(services, registerProcessor);
    expect(registerProcessor).toHaveBeenCalledWith("pm-entity-view", expect.any(Function));
  });

  // ─── Validation errors ─────────────────────────────────────────────────────

  it("shows error when entity field is missing", () => {
    const { el } = render("section: engagements");
    expect(el.querySelector(".pm-error")).not.toBeNull();
    expect(el.innerHTML).toContain("entity");
  });

  it("shows error when section field is missing", () => {
    const { el } = render("entity: client");
    expect(el.querySelector(".pm-error")).not.toBeNull();
    expect(el.innerHTML).toContain("section");
  });

  it("shows error for unknown entity type", () => {
    const { el } = render("entity: unknown-entity\nsection: stuff");
    expect(el.querySelector(".pm-error")).not.toBeNull();
    expect(el.innerHTML).toContain("unknown-entity");
  });

  it("shows error for unknown section on valid entity", () => {
    const { el } = render("entity: client\nsection: unknown-section");
    expect(el.querySelector(".pm-error")).not.toBeNull();
    expect(el.innerHTML).toContain("unknown-section");
  });

  it("shows error for invalid YAML", () => {
    const { el } = render(": broken: [yaml");
    expect(el.querySelector(".pm-error")).not.toBeNull();
  });

  // ─── client / engagements ─────────────────────────────────────────────────

  describe("client / engagements", () => {
    it("renders h2 heading 'Engagements'", () => {
      const { el } = render("entity: client\nsection: engagements", "clients/Acme.md");
      const h2 = el.querySelector("h2");
      expect(h2?.textContent).toBe("Engagements");
    });

    it("renders 'New Engagement' action button", () => {
      const { el } = render("entity: client\nsection: engagements", "clients/Acme.md");
      const buttons = el.querySelectorAll("button");
      expect([...buttons].some((b) => b.textContent === "New Engagement")).toBe(true);
    });

    it("renders table when engagements exist", () => {
      const { services, registerProcessor, getHandler } = createMockServices("clients/Acme.md");
      registerPmEntityViewProcessor(services, registerProcessor);
      (services.queryService.getLinkedEntities as ReturnType<typeof vi.fn>).mockReturnValue([
        createMockPage({ path: "engagements/Eng1.md", frontmatter: { status: "Active" } }),
      ]);
      const el = document.createElement("div");
      const ctx = { addChild: (c: { render: () => void }) => c.render(), sourcePath: "clients/Acme.md" };
      getHandler()("entity: client\nsection: engagements", el, ctx);
      expect(el.querySelector("table")).not.toBeNull();
    });

    it("shows 'No engagements found' when empty", () => {
      const { el } = render("entity: client\nsection: engagements", "clients/Acme.md");
      expect(el.innerHTML).toContain("No engagements found");
    });
  });

  // ─── client / people ─────────────────────────────────────────────────────

  describe("client / people", () => {
    it("renders h2 heading 'People'", () => {
      const { el } = render("entity: client\nsection: people", "clients/Acme.md");
      expect(el.querySelector("h2")?.textContent).toBe("People");
    });

    it("renders 'New Person' action button", () => {
      const { el } = render("entity: client\nsection: people", "clients/Acme.md");
      const buttons = el.querySelectorAll("button");
      expect([...buttons].some((b) => b.textContent === "New Person")).toBe(true);
    });

    it("shows 'No people found' when empty", () => {
      const { el } = render("entity: client\nsection: people", "clients/Acme.md");
      expect(el.innerHTML).toContain("No people found");
    });
  });

  // ─── engagement / projects ────────────────────────────────────────────────

  describe("engagement / projects", () => {
    it("renders h2 heading 'Projects'", () => {
      const { el } = render("entity: engagement\nsection: projects", "engagements/Eng1.md");
      expect(el.querySelector("h2")?.textContent).toBe("Projects");
    });

    it("renders 'New Project' action button", () => {
      const { el } = render("entity: engagement\nsection: projects", "engagements/Eng1.md");
      const buttons = el.querySelectorAll("button");
      expect([...buttons].some((b) => b.textContent === "New Project")).toBe(true);
    });

    it("shows 'No projects found' when empty", () => {
      const { el } = render("entity: engagement\nsection: projects", "engagements/Eng1.md");
      expect(el.innerHTML).toContain("No projects found");
    });
  });

  // ─── project / linked ─────────────────────────────────────────────────────

  describe("project / linked", () => {
    it("renders h2 heading 'Linked'", () => {
      const { el } = render("entity: project\nsection: linked", "projects/Proj1.md");
      expect(el.querySelector("h2")?.textContent).toBe("Linked");
    });

    it("renders 'New Project Note' action button", () => {
      const { el } = render("entity: project\nsection: linked", "projects/Proj1.md");
      const buttons = el.querySelectorAll("button");
      expect([...buttons].some((b) => b.textContent === "New Project Note")).toBe(true);
    });

    it("shows 'No related notes' when empty", () => {
      const { el } = render("entity: project\nsection: linked", "projects/Proj1.md");
      expect(el.innerHTML).toContain("No related notes");
    });
  });

  // ─── person / mentions ────────────────────────────────────────────────────

  describe("person / mentions", () => {
    it("renders h2 heading 'Mentions'", () => {
      const { el } = render("entity: person\nsection: mentions", "people/Alice.md");
      expect(el.querySelector("h2")?.textContent).toBe("Mentions");
    });

    it("does not render action buttons (no actions in registry)", () => {
      const { el } = render("entity: person\nsection: mentions", "people/Alice.md");
      expect(el.querySelectorAll("button").length).toBe(0);
    });

    it("shows 'No mentions found' when empty", () => {
      const { el } = render("entity: person\nsection: mentions", "people/Alice.md");
      expect(el.innerHTML).toContain("No mentions found");
    });
  });
});
