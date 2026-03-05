import { describe, it, expect, vi } from "vitest";
import {
  renderActionButtons,
  renderEntityTable,
  buildTable,
  fileLink,
  statusBadge,
} from "../../src/processors/shared-renderers";
import { createMockPage } from "../mocks/dataview-mock";
import { TFile } from "../mocks/obsidian-mock";
import type { PluginServices } from "../../src/plugin-context";
import type { PmActionConfig } from "../../src/types";
import { DEFAULT_FOLDERS } from "../../src/constants";

// ─── Mock factory ────────────────────────────────────────────────────────────

function createMockServices(sourcePath = "clients/Acme.md") {
  const sourceFile = new TFile(sourcePath);

  const executeCommandById = vi.fn();
  const app = {
    vault: {
      getAbstractFileByPath: vi.fn().mockReturnValue(sourceFile),
    },
    commands: { executeCommandById },
  };

  const queryService = {
    getLinkedEntities: vi.fn().mockReturnValue([]),
    getProjectNotes: vi.fn().mockReturnValue([]),
    getMentions: vi.fn().mockReturnValue([]),
  };

  const services = {
    app,
    queryService,
    settings: { folders: DEFAULT_FOLDERS },
    pendingActionContext: null as { field: string; value: string } | null,
  } as unknown as PluginServices;

  return { services, app, queryService, executeCommandById };
}

// ─── renderActionButtons ─────────────────────────────────────────────────────

describe("renderActionButtons", () => {
  it("renders nothing when actions array is empty", () => {
    const { services } = createMockServices();
    const el = document.createElement("div");
    renderActionButtons(el, [], services);
    expect(el.querySelectorAll("button").length).toBe(0);
  });

  it("renders one button per action", () => {
    const { services } = createMockServices();
    const el = document.createElement("div");
    const actions: PmActionConfig[] = [
      { type: "create-client", label: "New Client", style: "primary" },
      { type: "create-project", label: "New Project" },
    ];
    renderActionButtons(el, actions, services);
    const btns = el.querySelectorAll("button");
    expect(btns.length).toBe(2);
    expect(btns[0].textContent).toBe("New Client");
    expect(btns[1].textContent).toBe("New Project");
  });

  it("adds mod-cta class for primary style", () => {
    const { services } = createMockServices();
    const el = document.createElement("div");
    renderActionButtons(el, [{ type: "create-client", label: "X", style: "primary" }], services);
    expect(el.querySelector("button")?.classList.contains("mod-cta")).toBe(true);
  });

  it("adds mod-destructive class for destructive style", () => {
    const { services } = createMockServices();
    const el = document.createElement("div");
    renderActionButtons(el, [{ type: "scaffold-vault", label: "X", style: "destructive" }], services);
    expect(el.querySelector("button")?.classList.contains("mod-destructive")).toBe(true);
  });

  it("disables button for unknown action type with no commandId", () => {
    const { services } = createMockServices();
    const el = document.createElement("div");
    renderActionButtons(el, [{ type: "unknown-action", label: "X" }], services);
    const btn = el.querySelector("button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("executes command when button is clicked", () => {
    const { services, executeCommandById } = createMockServices();
    const el = document.createElement("div");
    renderActionButtons(el, [{ type: "create-client", label: "X" }], services);
    el.querySelector("button")?.click();
    expect(executeCommandById).toHaveBeenCalledWith("project-manager:create-client");
  });

  it("uses custom commandId when provided", () => {
    const { services, executeCommandById } = createMockServices();
    const el = document.createElement("div");
    renderActionButtons(el, [{ type: "custom", label: "X", commandId: "my-plugin:cmd" }], services);
    el.querySelector("button")?.click();
    expect(executeCommandById).toHaveBeenCalledWith("my-plugin:cmd");
  });

  it("sets pendingActionContext when action has context field", () => {
    const { services } = createMockServices("clients/Acme.md");
    const el = document.createElement("div");
    renderActionButtons(
      el,
      [{ type: "create-engagement", label: "X", context: { field: "client" } }],
      services,
      "clients/Acme.md"
    );
    el.querySelector("button")?.click();
    expect(services.pendingActionContext).toEqual({ field: "client", value: "Acme" });
  });

  it("does not set pendingActionContext when no context field", () => {
    const { services } = createMockServices("clients/Acme.md");
    const el = document.createElement("div");
    renderActionButtons(
      el,
      [{ type: "create-client", label: "X" }],
      services,
      "clients/Acme.md"
    );
    el.querySelector("button")?.click();
    expect(services.pendingActionContext).toBeNull();
  });
});

// ─── renderEntityTable ────────────────────────────────────────────────────────

describe("renderEntityTable", () => {
  it("shows error when file not found", () => {
    const { services } = createMockServices();
    (services.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const el = document.createElement("div");
    renderEntityTable(el, "client-engagements", "clients/Acme.md", services);
    expect(el.querySelector(".pm-error")).not.toBeNull();
  });

  it("shows 'No engagements found' for client-engagements when empty", () => {
    const { services } = createMockServices();
    const el = document.createElement("div");
    renderEntityTable(el, "client-engagements", "clients/Acme.md", services);
    expect(el.innerHTML).toContain("No engagements found");
  });

  it("shows 'No people found' for client-people when empty", () => {
    const { services } = createMockServices();
    const el = document.createElement("div");
    renderEntityTable(el, "client-people", "clients/Acme.md", services);
    expect(el.innerHTML).toContain("No people found");
  });

  it("shows 'No projects found' for engagement-projects when empty", () => {
    const { services } = createMockServices();
    const el = document.createElement("div");
    renderEntityTable(el, "engagement-projects", "engagements/Eng1.md", services);
    expect(el.innerHTML).toContain("No projects found");
  });

  it("shows 'No mentions found' for mentions when empty", () => {
    const { services } = createMockServices("people/Alice.md");
    const sourceFile = new TFile("people/Alice.md");
    (services.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(sourceFile);
    const el = document.createElement("div");
    renderEntityTable(el, "mentions", "people/Alice.md", services);
    expect(el.innerHTML).toContain("No mentions found");
  });

  it("shows 'No related notes' for related-project-notes when empty", () => {
    const { services } = createMockServices("projects/Proj1.md");
    const sourceFile = new TFile("projects/Proj1.md");
    (services.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(sourceFile);
    const el = document.createElement("div");
    renderEntityTable(el, "related-project-notes", "projects/Proj1.md", services);
    expect(el.innerHTML).toContain("No related notes");
  });

  it("shows error for unknown table type", () => {
    const { services } = createMockServices();
    const el = document.createElement("div");
    renderEntityTable(el, "totally-unknown" as never, "clients/Acme.md", services);
    expect(el.querySelector(".pm-error")).not.toBeNull();
  });

  it("renders engagement table with data", () => {
    const { services, queryService } = createMockServices();
    queryService.getLinkedEntities.mockReturnValue([
      createMockPage({ path: "engagements/Eng1.md", frontmatter: { status: "Active", "start-date": "2024-01-01" } }),
    ]);
    const el = document.createElement("div");
    renderEntityTable(el, "client-engagements", "clients/Acme.md", services);
    expect(el.querySelector("table")).not.toBeNull();
    expect(el.innerHTML).toContain("Eng1");
  });

  it("renders people table with data", () => {
    const { services, queryService } = createMockServices();
    queryService.getLinkedEntities.mockReturnValue([
      createMockPage({ path: "people/Alice.md", frontmatter: { status: "Active", title: "Manager" } }),
    ]);
    const el = document.createElement("div");
    renderEntityTable(el, "client-people", "clients/Acme.md", services);
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
