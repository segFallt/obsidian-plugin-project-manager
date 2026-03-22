import { describe, it, expect, vi } from "vitest";
import { renderActionButtons } from "@/processors/action-renderers";
import { renderEntityTable, buildTable, fileLink, statusBadge } from "@/processors/table-renderers";
import { createMockPage } from "../mocks/dataview-mock";
import { TFile } from "../mocks/obsidian-mock";
import type { ActionProcessorServices, PropertyProcessorServices } from "@/plugin-context";
import type { PmActionConfig } from "@/types";
import { DEFAULT_FOLDERS } from "@/constants";
import { ActionContextManager } from "@/services/action-context-manager";

// ─── Mock factory ────────────────────────────────────────────────────────────

function createMockServices(sourcePath = "clients/Acme.md") {
  const sourceFile = new TFile(sourcePath);

  const executeCommandById = vi.fn();
  const actionContext = new ActionContextManager();
  const app = {
    vault: {
      getAbstractFileByPath: vi.fn().mockReturnValue(sourceFile),
    },
  };

  const queryService = {
    getLinkedEntities: vi.fn().mockReturnValue([]),
    getProjectNotes: vi.fn().mockReturnValue([]),
    getMentions: vi.fn().mockReturnValue([]),
  };

  const actionServices = {
    app,
    settings: { folders: DEFAULT_FOLDERS },
    loggerService: { error: vi.fn(), warn: vi.fn() },
    commandExecutor: { executeCommandById },
    actionContext,
  } as unknown as ActionProcessorServices;

  const propertyServices = {
    app,
    queryService,
    settings: { folders: DEFAULT_FOLDERS },
    loggerService: { error: vi.fn(), warn: vi.fn() },
  } as unknown as PropertyProcessorServices;

  return { actionServices, propertyServices, app, queryService, executeCommandById, actionContext };
}

// ─── renderActionButtons ─────────────────────────────────────────────────────

describe("renderActionButtons", () => {
  it("renders nothing when actions array is empty", () => {
    const { actionServices } = createMockServices();
    const el = document.createElement("div");
    renderActionButtons(el, [], actionServices);
    expect(el.querySelectorAll("button").length).toBe(0);
  });

  it("renders one button per action", () => {
    const { actionServices } = createMockServices();
    const el = document.createElement("div");
    const actions: PmActionConfig[] = [
      { type: "create-client", label: "New Client", style: "primary" },
      { type: "create-project", label: "New Project" },
    ];
    renderActionButtons(el, actions, actionServices);
    const btns = el.querySelectorAll("button");
    expect(btns.length).toBe(2);
    expect(btns[0].textContent).toBe("New Client");
    expect(btns[1].textContent).toBe("New Project");
  });

  it("adds mod-cta class for primary style", () => {
    const { actionServices } = createMockServices();
    const el = document.createElement("div");
    renderActionButtons(el, [{ type: "create-client", label: "X", style: "primary" }], actionServices);
    expect(el.querySelector("button")?.classList.contains("mod-cta")).toBe(true);
  });

  it("adds mod-destructive class for destructive style", () => {
    const { actionServices } = createMockServices();
    const el = document.createElement("div");
    renderActionButtons(el, [{ type: "scaffold-vault", label: "X", style: "destructive" }], actionServices);
    expect(el.querySelector("button")?.classList.contains("mod-destructive")).toBe(true);
  });

  it("disables button for unknown action type with no commandId", () => {
    const { actionServices } = createMockServices();
    const el = document.createElement("div");
    renderActionButtons(el, [{ type: "unknown-action", label: "X" }], actionServices);
    const btn = el.querySelector("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("executes command when button is clicked", () => {
    const { actionServices, executeCommandById } = createMockServices();
    const el = document.createElement("div");
    renderActionButtons(el, [{ type: "create-client", label: "X" }], actionServices);
    el.querySelector("button")?.click();
    expect(executeCommandById).toHaveBeenCalledWith("project-manager:create-client");
  });

  it("uses custom commandId when provided", () => {
    const { actionServices, executeCommandById } = createMockServices();
    const el = document.createElement("div");
    renderActionButtons(el, [{ type: "custom", label: "X", commandId: "my-plugin:cmd" }], actionServices);
    el.querySelector("button")?.click();
    expect(executeCommandById).toHaveBeenCalledWith("my-plugin:cmd");
  });

  it("sets actionContext when action has context field", () => {
    const { actionServices, actionContext } = createMockServices("clients/Acme.md");
    const el = document.createElement("div");
    renderActionButtons(
      el,
      [{ type: "create-engagement", label: "X", context: { field: "client" } }],
      actionServices,
      "clients/Acme.md"
    );
    el.querySelector("button")?.click();
    expect(actionContext.get()).toEqual({ field: "client", value: "Acme" });
  });

  it("does not set actionContext when no context field", () => {
    const { actionServices, actionContext } = createMockServices("clients/Acme.md");
    const el = document.createElement("div");
    renderActionButtons(
      el,
      [{ type: "create-client", label: "X" }],
      actionServices,
      "clients/Acme.md"
    );
    el.querySelector("button")?.click();
    expect(actionContext.get()).toBeNull();
  });
});

// ─── renderEntityTable ────────────────────────────────────────────────────────

describe("renderEntityTable", () => {
  it("shows error when file not found", () => {
    const { propertyServices } = createMockServices();
    (propertyServices.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const el = document.createElement("div");
    renderEntityTable(el, "client-engagements", "clients/Acme.md", propertyServices);
    expect(el.querySelector(".pm-error")).not.toBeNull();
  });

  it("shows 'No engagements found' for client-engagements when empty", () => {
    const { propertyServices } = createMockServices();
    const el = document.createElement("div");
    renderEntityTable(el, "client-engagements", "clients/Acme.md", propertyServices);
    expect(el.innerHTML).toContain("No engagements found");
  });

  it("shows 'No people found' for client-people when empty", () => {
    const { propertyServices } = createMockServices();
    const el = document.createElement("div");
    renderEntityTable(el, "client-people", "clients/Acme.md", propertyServices);
    expect(el.innerHTML).toContain("No people found");
  });

  it("shows 'No projects found' for engagement-projects when empty", () => {
    const { propertyServices } = createMockServices();
    const el = document.createElement("div");
    renderEntityTable(el, "engagement-projects", "engagements/Eng1.md", propertyServices);
    expect(el.innerHTML).toContain("No projects found");
  });

  it("shows 'No mentions found' for mentions when empty", () => {
    const { propertyServices } = createMockServices("people/Alice.md");
    const sourceFile = new TFile("people/Alice.md");
    (propertyServices.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(sourceFile);
    const el = document.createElement("div");
    renderEntityTable(el, "mentions", "people/Alice.md", propertyServices);
    expect(el.innerHTML).toContain("No mentions found");
  });

  it("shows 'No related notes' for related-project-notes when empty", () => {
    const { propertyServices } = createMockServices("projects/Proj1.md");
    const sourceFile = new TFile("projects/Proj1.md");
    (propertyServices.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(sourceFile);
    const el = document.createElement("div");
    renderEntityTable(el, "related-project-notes", "projects/Proj1.md", propertyServices);
    expect(el.innerHTML).toContain("No related notes");
  });

  it("shows error for unknown table type", () => {
    const { propertyServices } = createMockServices();
    const el = document.createElement("div");
    renderEntityTable(el, "totally-unknown" as never, "clients/Acme.md", propertyServices);
    expect(el.querySelector(".pm-error")).not.toBeNull();
  });

  it("renders engagement table with data", () => {
    const { propertyServices, queryService } = createMockServices();
    queryService.getLinkedEntities.mockReturnValue([
      createMockPage({ path: "engagements/Eng1.md", frontmatter: { status: "Active", "start-date": "2024-01-01" } }),
    ]);
    const el = document.createElement("div");
    renderEntityTable(el, "client-engagements", "clients/Acme.md", propertyServices);
    expect(el.querySelector("table")).not.toBeNull();
    expect(el.innerHTML).toContain("Eng1");
  });

  it("renders people table with data", () => {
    const { propertyServices, queryService } = createMockServices();
    queryService.getLinkedEntities.mockReturnValue([
      createMockPage({ path: "people/Alice.md", frontmatter: { status: "Active", title: "Manager" } }),
    ]);
    const el = document.createElement("div");
    renderEntityTable(el, "client-people", "clients/Acme.md", propertyServices);
    expect(el.querySelector("table")).not.toBeNull();
    expect(el.innerHTML).toContain("Alice");
  });
});

// ─── buildTable ───────────────────────────────────────────────────────────────

describe("buildTable", () => {
  it("creates a table with correct headers", () => {
    const el = document.createElement("div");
    buildTable(el, ["Name", "Status"], []);
    const ths = el.querySelectorAll("th");
    expect(ths.length).toBe(2);
    expect(ths[0].textContent).toBe("Name");
    expect(ths[1].textContent).toBe("Status");
  });

  it("creates a row for each data entry", () => {
    const el = document.createElement("div");
    buildTable(el, ["A", "B"], [["r1c1", "r1c2"], ["r2c1", "r2c2"]]);
    expect(el.querySelectorAll("tr").length).toBe(3); // 1 header + 2 data
  });
});

// ─── fileLink ────────────────────────────────────────────────────────────────

describe("fileLink", () => {
  it("returns an internal-link anchor with correct href and text", () => {
    const page = createMockPage({ path: "clients/Acme.md" });
    const link = fileLink(page);
    expect(link).toContain("data-href=\"clients/Acme.md\"");
    expect(link).toContain("Acme");
    expect(link).toContain("internal-link");
  });
});

// ─── statusBadge ─────────────────────────────────────────────────────────────

describe("statusBadge", () => {
  it("wraps status in a span with correct class", () => {
    const badge = statusBadge("Active");
    expect(badge).toContain("pm-status-badge--active");
    expect(badge).toContain(">Active<");
  });

  it("converts multi-word status to kebab-case class", () => {
    const badge = statusBadge("On Hold");
    expect(badge).toContain("pm-status-badge--on-hold");
  });
});
