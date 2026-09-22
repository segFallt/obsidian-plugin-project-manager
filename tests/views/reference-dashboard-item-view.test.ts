import { describe, it, expect, vi, afterEach } from "vitest";
import { ReferenceDashboardItemView } from "@/views/reference-dashboard-item-view";
import { PM_REFERENCE_DASHBOARD_VIEW_TYPE } from "@/constants";
import { createMockDataviewApi } from "../mocks/dataview-mock";
import type { MockPageData } from "../mocks/dataview-mock";
import { App, TFile, TFolder } from "obsidian";

afterEach(() => {
  vi.useRealTimers();
});

// ─── Mock plugin factory ──────────────────────────────────────────────────────

function makePlugin(referenceDashboardFilters: Record<string, unknown> = {}, referencePages: MockPageData[] = []) {
  const app = new App();
  const saveSettings = vi.fn().mockResolvedValue(undefined);
  const dv = createMockDataviewApi(referencePages);

  return {
    app,
    saveSettings,
    settings: { ui: { referenceDashboardFilters } },
    queryService: {
      dv: vi.fn(() => dv),
      getActiveEntitiesByTag: vi.fn(() => []),
      getClientFromEngagementLink: vi.fn(() => null),
    },
    hierarchyService: {
      resolveClientName: vi.fn(() => null),
      resolveEngagementName: vi.fn(() => null),
    },
    navigationService: {
      openFile: vi.fn().mockResolvedValue(undefined),
    },
    loggerService: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    commandExecutor: { executeCommandById: vi.fn() },
    actionContext: { set: vi.fn() },
  };
}

function makeView(referenceDashboardFilters: Record<string, unknown> = {}, referencePages: MockPageData[] = []) {
  const plugin = makePlugin(referenceDashboardFilters, referencePages);
  const view = new ReferenceDashboardItemView(
    {} as import("obsidian").WorkspaceLeaf,
    plugin as unknown as import("@/main").default
  );
  return { view, plugin };
}

const REF_PAGE: MockPageData = {
  path: "reference/references/My Note.md",
  name: "My Note",
  tags: ["#reference"],
  frontmatter: { topics: ["[[Architecture]]"] },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ReferenceDashboardItemView", () => {
  describe("static metadata", () => {
    it("constructs without throwing when the base ctor queries the view type", () => {
      // Obsidian 1.7.2+ calls this.getViewType() during the ItemView base
      // constructor (modelled by the obsidian mock). The getters must return
      // constants that read no post-super() state, or construction throws and
      // Obsidian shows the "plugin has gone away" placeholder.
      expect(() => makeView()).not.toThrow();
    });

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

    it("does not register a vault modify listener (settings-backed, no echo)", async () => {
      const { view, plugin } = makeView();
      const vaultOn = vi.spyOn(plugin.app.vault, "on");
      await view.onOpen();
      expect(vaultOn).not.toHaveBeenCalledWith("modify", expect.any(Function));
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

  describe("filter change callback (persisted through the store, debounced)", () => {
    it("updates plugin.settings.ui.referenceDashboardFilters after the debounce fires", async () => {
      vi.useFakeTimers();
      const { view, plugin } = makeView();
      await view.onOpen();

      const tabs = [...view.contentEl.querySelectorAll<HTMLButtonElement>(".pm-references__tab")];
      const clientTab = tabs.find((t) => t.textContent === "By Client");
      expect(clientTab).not.toBeUndefined();
      clientTab!.click();

      await vi.runAllTimersAsync();
      expect(plugin.settings.ui.referenceDashboardFilters).toMatchObject({ viewMode: "client" });
    });

    it("calls plugin.saveSettings() when filters change (after debounce)", async () => {
      vi.useFakeTimers();
      const { view, plugin } = makeView();
      await view.onOpen();

      const tabs = [...view.contentEl.querySelectorAll<HTMLButtonElement>(".pm-references__tab")];
      const engagementTab = tabs.find((t) => t.textContent === "By Engagement");
      engagementTab!.click();

      await vi.runAllTimersAsync();
      expect(plugin.saveSettings).toHaveBeenCalled();
    });
  });

  describe("saved filters restoration", () => {
    it("activates the saved view mode tab on open", async () => {
      const { view } = makeView({ viewMode: "client" });
      await view.onOpen();
      const activeTab = view.contentEl.querySelector<HTMLButtonElement>(".pm-references__tab--active");
      expect(activeTab?.textContent).toBe("By Client");
    });

    it("succeeds with no saved filters and defaults to topic mode", async () => {
      const { view } = makeView(undefined as unknown as Record<string, unknown>);
      await expect(view.onOpen()).resolves.not.toThrow();
      const activeTab = view.contentEl.querySelector<HTMLButtonElement>(".pm-references__tab--active");
      expect(activeTab?.textContent).toBe("By Topic");
    });
  });

  describe("actions row", () => {
    it("renders the actions row before the dashboard content", async () => {
      const { view } = makeView();
      await view.onOpen();
      const actionsRow = view.contentEl.querySelector(".pm-reference-dashboard__actions");
      const dashboard = view.contentEl.querySelector(".pm-references");
      expect(actionsRow).not.toBeNull();
      expect(dashboard).not.toBeNull();
      const directChildren = [...view.contentEl.children];
      const actionsRowIndex = directChildren.indexOf(actionsRow!);
      const dashboardContainerIndex = directChildren.findIndex((c) => c.contains(dashboard!));
      expect(actionsRowIndex).toBeGreaterThanOrEqual(0);
      expect(dashboardContainerIndex).toBeGreaterThanOrEqual(0);
      expect(actionsRowIndex).toBeLessThan(dashboardContainerIndex);
    });

    it("renders '+ New Reference' and '+ New Topic' buttons", async () => {
      const { view } = makeView();
      await view.onOpen();
      const btns = [...view.contentEl.querySelectorAll<HTMLButtonElement>(".pm-reference-dashboard__actions__button")];
      expect(btns.find((b) => b.textContent === "+ New Reference")).not.toBeUndefined();
      expect(btns.find((b) => b.textContent === "+ New Topic")).not.toBeUndefined();
    });

    it("clicking '+ New Reference' with selectedNode calls actionContext.set then executeCommandById", async () => {
      const { view, plugin } = makeView({ selectedNode: "Kubernetes" });
      await view.onOpen();
      const btns = [...view.contentEl.querySelectorAll<HTMLButtonElement>(".pm-reference-dashboard__actions__button")];
      [...btns].find((b) => b.textContent === "+ New Reference")!.click();
      expect(plugin.actionContext.set).toHaveBeenCalledWith({ field: "topic", value: "Kubernetes" });
      expect(plugin.commandExecutor.executeCommandById).toHaveBeenCalledWith("create-reference");
    });

    it("clicking '+ New Reference' with no selectedNode skips actionContext.set but still executes command", async () => {
      const { view, plugin } = makeView({});
      await view.onOpen();
      const btns = [...view.contentEl.querySelectorAll<HTMLButtonElement>(".pm-reference-dashboard__actions__button")];
      [...btns].find((b) => b.textContent === "+ New Reference")!.click();
      expect(plugin.actionContext.set).not.toHaveBeenCalled();
      expect(plugin.commandExecutor.executeCommandById).toHaveBeenCalledWith("create-reference");
    });

    it("clicking '+ New Topic' calls executeCommandById and not actionContext.set", async () => {
      const { view, plugin } = makeView();
      await view.onOpen();
      const btns = [...view.contentEl.querySelectorAll<HTMLButtonElement>(".pm-reference-dashboard__actions__button")];
      [...btns].find((b) => b.textContent === "+ New Topic")!.click();
      expect(plugin.commandExecutor.executeCommandById).toHaveBeenCalledWith("create-reference-topic");
      expect(plugin.actionContext.set).not.toHaveBeenCalled();
    });
  });

  describe("reference card click", () => {
    it("clicking a reference card title calls navigationService.openFile with the matching TFile", async () => {
      const mockFile = new TFile(REF_PAGE.path);
      const { view, plugin } = makeView({}, [REF_PAGE]);
      vi.spyOn(plugin.app.vault, "getAbstractFileByPath").mockReturnValue(mockFile);

      await view.onOpen();
      await Promise.resolve();

      const link = view.contentEl.querySelector<HTMLAnchorElement>(".internal-link");
      expect(link).not.toBeNull();
      link!.click();
      expect(plugin.navigationService.openFile).toHaveBeenCalledWith(mockFile);
    });

    it("does NOT call navigationService.openFile when getAbstractFileByPath returns null", async () => {
      const { view, plugin } = makeView({}, [REF_PAGE]);
      vi.spyOn(plugin.app.vault, "getAbstractFileByPath").mockReturnValue(null);

      await view.onOpen();
      await Promise.resolve();

      const link = view.contentEl.querySelector<HTMLAnchorElement>(".internal-link");
      expect(link).not.toBeNull();
      link!.click();
      expect(plugin.navigationService.openFile).not.toHaveBeenCalled();
    });

    it("does NOT call navigationService.openFile when getAbstractFileByPath returns a TFolder", async () => {
      const { view, plugin } = makeView({}, [REF_PAGE]);
      vi.spyOn(plugin.app.vault, "getAbstractFileByPath").mockReturnValue(new TFolder("some/path"));

      await view.onOpen();
      await Promise.resolve();

      const link = view.contentEl.querySelector<HTMLAnchorElement>(".internal-link");
      expect(link).not.toBeNull();
      link!.click();
      expect(plugin.navigationService.openFile).not.toHaveBeenCalled();
    });
  });
});
