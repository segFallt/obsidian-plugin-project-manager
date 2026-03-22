import { describe, it, expect, vi } from "vitest";
import { registerPmRaidDashboardProcessor } from "@/processors/pm-raid-dashboard-processor";
import type { RaidProcessorServices } from "@/services/interfaces";
import type { DataviewPage } from "@/types";

// ─── Mock item factory ────────────────────────────────────────────────────

function makeMockItem(overrides: Partial<{
  name: string;
  path: string;
  raidType: string;
  status: string;
  likelihood: string;
  impact: string;
  owner: string;
  raisedDate: string;
  client: unknown;
  engagement: unknown;
}>): DataviewPage {
  const name = overrides.name ?? "Test Risk";
  const path = overrides.path ?? `raid/${name}.md`;
  return {
    file: {
      name,
      path,
      folder: "raid",
      link: { path },
      tags: ["#raid"],
      mtime: { valueOf: () => Date.now(), toISO: () => new Date().toISOString() },
      tasks: { length: 0, values: [], where: vi.fn(), sort: vi.fn(), map: vi.fn(), filter: vi.fn(), [Symbol.iterator]: [][Symbol.iterator] } as unknown as DataviewPage["file"]["tasks"],
    },
    "raid-type": overrides.raidType ?? "Risk",
    status: overrides.status ?? "Open",
    likelihood: overrides.likelihood ?? "High",
    impact: overrides.impact ?? "High",
    owner: overrides.owner ?? "",
    "raised-date": overrides.raisedDate ?? "2025-01-01",
    client: overrides.client ?? undefined,
    engagement: overrides.engagement ?? undefined,
  } as unknown as DataviewPage;
}

// ─── Mock services factory ────────────────────────────────────────────────

function createMockServices(items: DataviewPage[] = []) {
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
    registerMarkdownCodeBlockProcessor: vi.fn((_lang: string, handler: typeof registeredHandler) => {
      registeredHandler = handler;
    }),
  };

  const services: RaidProcessorServices = {
    app: {
      vault: { on: vaultOn },
    } as unknown as RaidProcessorServices["app"],
    queryService: {
      getActiveRaidItems: vi.fn(() => items),
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
    vaultOn,
    getHandler: () => registeredHandler!,
  };
}

// ─── Render helper ─────────────────────────────────────────────────────────

function render(items: DataviewPage[] = [], source = "") {
  const { services, mockPlugin, getHandler, vaultOn } = createMockServices(items);

  registerPmRaidDashboardProcessor(
    mockPlugin as unknown as Parameters<typeof registerPmRaidDashboardProcessor>[0],
    services
  );

  const el = document.createElement("div");
  const children: Array<{
    render(): void;
    onload?(): void;
    onunload?(): void;
    registerEvent?(ref: unknown): void;
  }> = [];

  const ctx = {
    addChild: (child: (typeof children)[0]) => {
      children.push(child);
      child.render();
    },
    sourcePath: "utility/RAID Dashboard.md",
  };

  getHandler()(source, el, ctx);

  return { el, children, vaultOn, services };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("pm-raid-dashboard processor", () => {
  it("registers a 'pm-raid-dashboard' code block processor", () => {
    const { services, mockPlugin } = createMockServices();
    registerPmRaidDashboardProcessor(
      mockPlugin as unknown as Parameters<typeof registerPmRaidDashboardProcessor>[0],
      services
    );
    expect(mockPlugin.registerMarkdownCodeBlockProcessor).toHaveBeenCalledWith(
      "pm-raid-dashboard",
      expect.any(Function)
    );
  });

  it("renders matrix with mock RAID items", () => {
    const items = [
      makeMockItem({ raidType: "Risk", status: "Open", likelihood: "High", impact: "High" }),
      makeMockItem({ name: "Low Impact Issue", raidType: "Issue", status: "Open", likelihood: "Low", impact: "Low" }),
    ];

    const { el } = render(items);

    const matrix = el.querySelector(".raid-matrix");
    expect(matrix).not.toBeNull();

    // The High×High cell should show count "1"
    const cells = el.querySelectorAll(".raid-cell--hh");
    expect(cells.length).toBeGreaterThan(0);
  });

  it("renders count strip with RAID type counts", () => {
    const items = [
      makeMockItem({ raidType: "Risk", status: "Open" }),
      makeMockItem({ name: "Assumption 1", raidType: "Assumption", status: "Open" }),
      makeMockItem({ name: "Assumption 2", raidType: "Assumption", status: "Open" }),
    ];

    const { el } = render(items);
    const counts = el.querySelector(".pm-raid-dashboard__counts");
    expect(counts).not.toBeNull();
    expect(counts?.textContent).toContain("Risks: 1");
    expect(counts?.textContent).toContain("Assumptions: 2");
  });

  it("renders item table sections for each RAID type with items", () => {
    const items = [
      makeMockItem({ raidType: "Risk", status: "Open" }),
      makeMockItem({ name: "Open Issue", raidType: "Issue", status: "Open" }),
    ];

    const { el } = render(items);

    const tables = el.querySelectorAll(".raid-item-table");
    // Should have one table per non-empty RAID type (Risk + Issue = 2)
    expect(tables.length).toBe(2);
  });

  it("hides RAID type sections with zero items under active filters", () => {
    const items = [
      makeMockItem({ raidType: "Risk", status: "Open" }),
    ];

    const { el } = render(items);

    // Decisions section should not appear since there are none
    const headers = Array.from(el.querySelectorAll(".raid-section-header"))
      .filter((h) => h.textContent?.includes("Decisions"));
    expect(headers.length).toBe(0);
  });

  it("renders filter panel with type and status chips", () => {
    const { el } = render([]);

    const filterPanel = el.querySelector(".pm-raid-dashboard__filters");
    expect(filterPanel).not.toBeNull();

    const chips = el.querySelectorAll(".raid-chip");
    // 4 RAID types + 4 statuses = 8 chips
    expect(chips.length).toBe(8);
  });

  it("filter chips toggle active state on click", () => {
    const items = [makeMockItem({ raidType: "Risk", status: "Open" })];
    const { el } = render(items);

    // Find the 'R' (Risk) chip — it should be active by default
    const chips = el.querySelectorAll(".raid-chip");
    const riskChip = Array.from(chips).find((c) => c.textContent === "R") as HTMLElement | undefined;
    expect(riskChip).toBeDefined();
    expect(riskChip?.classList.contains("raid-chip--active")).toBe(true);

    // Click to deactivate
    riskChip?.click();

    // After click, the dashboard re-renders — find the chip again
    const updatedChips = el.querySelectorAll(".raid-chip");
    const updatedRiskChip = Array.from(updatedChips).find((c) => c.textContent === "R");
    expect(updatedRiskChip?.classList.contains("raid-chip--active")).toBe(false);
  });

  it("shows empty table section when no items match filters", () => {
    // No items at all
    const { el } = render([]);

    // No item tables should be present
    const tables = el.querySelectorAll(".raid-item-table");
    expect(tables.length).toBe(0);
  });

  it("clientFilter matches items whose client is a DataviewLink object", () => {
    const items = [
      makeMockItem({ name: "Acme Risk", client: { path: "clients/Acme Corp.md" } }),
      makeMockItem({ name: "Beta Risk", client: { path: "clients/Beta Ltd.md" } }),
    ];

    // Apply clientFilter: ["Acme Corp"] via code block config
    const { el } = render(items, "clientFilter:\n  - Acme Corp");

    const tables = el.querySelectorAll(".raid-item-table");
    expect(tables.length).toBe(1);
    const rows = el.querySelectorAll(".raid-item-row");
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector("td")?.textContent).toBe("Acme Risk");
  });

  it("clientFilter excludes items that do not match the active filter", () => {
    const items = [
      makeMockItem({ name: "Acme Risk", client: { path: "clients/Acme Corp.md" } }),
      makeMockItem({ name: "Beta Risk", client: { path: "clients/Beta Ltd.md" } }),
    ];

    // Only "Beta Ltd" is active — "Acme Risk" should be excluded
    const { el } = render(items, "clientFilter:\n  - Beta Ltd");

    const rows = el.querySelectorAll(".raid-item-row");
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector("td")?.textContent).toBe("Beta Risk");
  });

  it("engagementFilter matches items whose engagement is a DataviewLink object", () => {
    const items = [
      makeMockItem({ name: "Alpha Issue", engagement: { path: "engagements/Alpha Project.md" } }),
      makeMockItem({ name: "Gamma Issue", engagement: { path: "engagements/Gamma Project.md" } }),
    ];

    const { el } = render(items, "engagementFilter:\n  - Alpha Project");

    const rows = el.querySelectorAll(".raid-item-row");
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector("td")?.textContent).toBe("Alpha Issue");
  });

  it("engagementFilter excludes items that do not match the active filter", () => {
    const items = [
      makeMockItem({ name: "Alpha Issue", engagement: { path: "engagements/Alpha Project.md" } }),
      makeMockItem({ name: "Gamma Issue", engagement: { path: "engagements/Gamma Project.md" } }),
    ];

    const { el } = render(items, "engagementFilter:\n  - Gamma Project");

    const rows = el.querySelectorAll(".raid-item-row");
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector("td")?.textContent).toBe("Gamma Issue");
  });

  it("auto-refresh is registered on vault modify in onload()", () => {
    const { services, mockPlugin, getHandler, vaultOn } = createMockServices([]);
    registerPmRaidDashboardProcessor(
      mockPlugin as unknown as Parameters<typeof registerPmRaidDashboardProcessor>[0],
      services
    );

    const el = document.createElement("div");
    let capturedChild: { onload?(): void; registerEvent?(ref: unknown): void } | null = null;
    const ctx = {
      addChild: (child: typeof capturedChild) => {
        capturedChild = child;
      },
      sourcePath: "utility/RAID Dashboard.md",
    };

    getHandler()("", el, ctx);
    capturedChild?.onload?.();

    expect(vaultOn).toHaveBeenCalledWith("modify", expect.any(Function));
  });
});
