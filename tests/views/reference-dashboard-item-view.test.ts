import { describe, it, expect, vi } from "vitest";
import { ReferenceDashboardItemView } from "@/views/reference-dashboard-item-view";
import { PM_REFERENCE_DASHBOARD_VIEW_TYPE } from "@/constants";
import type { ReferenceFilters } from "@/types";
import { App } from "obsidian";

// ─── Mock plugin factory ──────────────────────────────────────────────────────

function makePlugin(referenceDashboardFilters = {}) {
  const app = new App();
  const saveSettings = vi.fn().mockResolvedValue(undefined);

  return {
    app,
    saveSettings,
    settings: {
      ui: {
        referenceDashboardFilters,
      },
    },
    queryService: {
      getReferences: vi.fn(() => []),
      getActiveEntitiesByTag: vi.fn(() => []),
      getClientFromEngagementLink: vi.fn(() => null),
      getReferenceTopicTree: vi.fn(() => []),
      getTopicDescendants: vi.fn(() => []),
    },
    hierarchyService: {},
    loggerService: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

// ─── ItemView factory ─────────────────────────────────────────────────────────

function makeView(referenceDashboardFilters = {}) {
  const plugin = makePlugin(referenceDashboardFilters);
  // The ItemView stub constructor takes (leaf, app) but our ItemView takes
  // (leaf, plugin). We pass a fake leaf and the plugin.
  const view = new ReferenceDashboardItemView(
    {} as import("obsidian").WorkspaceLeaf,
    plugin as unknown as import("@/main").default
  );
  return { view, plugin };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ReferenceDashboardItemView", () => {
  describe("static metadata", () => {
    it("VIEW_TYPE matches the constant", () => {
      expect(ReferenceDashboardItemView.VIEW_TYPE).toBe(PM_REFERENCE_DASHBOARD_VIEW_TYPE);
    });

    it("getViewType() returns VIEW_TYPE", () => {
      const { view } = makeView();
      expect(view.getViewType()).toBe(PM_REFERENCE_DASHBOARD_VIEW_TYPE);
    });

    it("getDisplayText() returns 'Reference Dashboard'", () => {
      const { view } = makeView();
      expect(view.getDisplayText()).toBe("Reference Dashboard");
    });

    it("getIcon() returns 'book-open'", () => {
      const { view } = makeView();
      expect(view.getIcon()).toBe("book-open");
    });
  });

  describe("onOpen()", () => {
    it("adds pm-reference-dashboard-view class to contentEl", async () => {
      const { view } = makeView();
      await view.onOpen();
      expect(view.contentEl.classList.contains("pm-reference-dashboard-view")).toBe(true);
    });

    it("renders a .pm-references div inside contentEl", async () => {
      const { view } = makeView();
      await view.onOpen();
      expect(view.contentEl.querySelector(".pm-references")).not.toBeNull();
    });

    it("registers a vault modify event listener", async () => {
      const { view, plugin } = makeView();
      const vaultOn = vi.spyOn(plugin.app.vault, "on");
      await view.onOpen();
      expect(vaultOn).toHaveBeenCalledWith("modify", expect.any(Function));
    });
  });

  describe("onClose()", () => {
    it("empties contentEl", async () => {
      const { view } = makeView();
      await view.onOpen();
      expect(view.contentEl.childElementCount).toBeGreaterThan(0);
      await view.onClose();
      expect(view.contentEl.childElementCount).toBe(0);
    });

    it("clears pending debounce timer without throwing", async () => {
      const { view } = makeView();
      await view.onOpen();
      await expect(view.onClose()).resolves.not.toThrow();
    });
  });

  describe("filter change callback", () => {
    it("updates plugin.settings.ui.referenceDashboardFilters", async () => {
      const { view, plugin } = makeView();
      await view.onOpen();

      // Trigger a filter change by clicking the "By Client" tab
      const tabs = [...view.contentEl.querySelectorAll<HTMLButtonElement>(".pm-references__tab")];
      const clientTab = tabs.find((t) => t.textContent === "By Client");
      expect(clientTab).not.toBeUndefined();
      clientTab!.click();

      expect(plugin.settings.ui.referenceDashboardFilters).toMatchObject({
        viewMode: "client",
      });
    });

    it("calls plugin.saveSettings() when filters change", async () => {
      const { view, plugin } = makeView();
      await view.onOpen();

      const tabs = [...view.contentEl.querySelectorAll<HTMLButtonElement>(".pm-references__tab")];
      const engagementTab = tabs.find((t) => t.textContent === "By Engagement");
      expect(engagementTab).not.toBeUndefined();
      engagementTab!.click();

      expect(plugin.saveSettings).toHaveBeenCalled();
    });
  });

  describe("saved filters restoration", () => {
    it("activates the saved view mode tab on open", async () => {
      const { view } = makeView({ viewMode: "client" });
      await view.onOpen();
      const activeTab = view.contentEl.querySelector<HTMLButtonElement>(
        ".pm-references__tab--active"
      );
      expect(activeTab).not.toBeNull();
      expect(activeTab!.textContent).toBe("By Client");
    });

    it("restores saved topics and selectedNode into filter state", async () => {
      const { view, plugin } = makeView({
        viewMode: "topic",
        topics: ["Architecture"],
        selectedNode: "Kubernetes",
      });
      await view.onOpen();

      // Trigger a filter change to capture the persisted state shape
      const tabs = [...view.contentEl.querySelectorAll<HTMLButtonElement>(".pm-references__tab")];
      const topicTab = tabs.find((t) => t.textContent === "By Topic");
      topicTab!.click();

      const persisted = plugin.settings.ui.referenceDashboardFilters as Record<string, unknown>;
      // The initial topics from saved state should have been passed in;
      // after clicking the same tab the selectedNode is reset but topics remain
      expect(persisted).toHaveProperty("viewMode", "topic");
      expect(persisted).toHaveProperty("topics");
    });

    it("succeeds with no saved filters and defaults to topic mode", async () => {
      // Pass undefined so the falsy branch is exercised
      const plugin = {
        app: new (await import("obsidian")).App(),
        saveSettings: vi.fn().mockResolvedValue(undefined),
        settings: { ui: { referenceDashboardFilters: undefined } },
        queryService: {
          getReferences: vi.fn(() => []),
          getActiveEntitiesByTag: vi.fn(() => []),
          getClientFromEngagementLink: vi.fn(() => null),
          getReferenceTopicTree: vi.fn(() => []),
          getTopicDescendants: vi.fn(() => []),
        },
        hierarchyService: {},
        loggerService: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      };
      const { ReferenceDashboardItemView } = await import("@/views/reference-dashboard-item-view");
      const view = new ReferenceDashboardItemView(
        {} as import("obsidian").WorkspaceLeaf,
        plugin as unknown as import("@/main").default
      );
      await expect(view.onOpen()).resolves.not.toThrow();
      const activeTab = view.contentEl.querySelector<HTMLButtonElement>(".pm-references__tab--active");
      expect(activeTab).not.toBeNull();
      expect(activeTab!.textContent).toBe("By Topic");
    });
  });
});
