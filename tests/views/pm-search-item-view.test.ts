import { describe, it, expect, vi } from "vitest";
import { PmSearchItemView } from "@/views/pm-search-item-view";
import {
  PM_SEARCH_VIEW_TYPE,
  PM_SEARCH_ICON,
  PM_SEARCH_TEXT,
  CSS_CLS,
  DEFAULT_FOLDERS,
} from "@/constants";
import { App } from "obsidian";

// ─── Mock plugin factory ──────────────────────────────────────────────────────

function makePlugin(ui: Record<string, unknown> = {}) {
  const app = new App();
  const saveSettings = vi.fn().mockResolvedValue(undefined);
  return {
    app,
    saveSettings,
    settings: { ui, folders: DEFAULT_FOLDERS },
    navigationService: { openFile: vi.fn().mockResolvedValue(undefined) },
    // Dataview off by default — the panel renders its "needs Dataview" state.
    queryService: {
      dv: () => null,
      getEntitiesByTag: () => [],
      getEntitiesByFolder: () => [],
    },
    hierarchyService: {
      resolveClientName: () => null,
      resolveEngagementName: () => null,
    },
    loggerService: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      cleanOldLogs: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function makeView(ui: Record<string, unknown> = {}) {
  const plugin = makePlugin(ui);
  const view = new PmSearchItemView(
    {} as import("obsidian").WorkspaceLeaf,
    plugin as unknown as import("@/main").default
  );
  return { view, plugin };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PmSearchItemView", () => {
  describe("view identity (constructor-safe getters)", () => {
    it("constructs without throwing when the base ctor queries the view type", () => {
      // Obsidian 1.7.2+ calls this.getViewType() during the ItemView base
      // constructor (modelled by the obsidian mock). The getters must return
      // constants that read no post-super() state, or construction throws and
      // Obsidian shows the "plugin has gone away" placeholder.
      expect(() => makeView()).not.toThrow();
    });

    it("VIEW_TYPE matches the constant", () => {
      expect(PmSearchItemView.VIEW_TYPE).toBe(PM_SEARCH_VIEW_TYPE);
    });

    it("getViewType() returns VIEW_TYPE", () => {
      const { view } = makeView();
      expect(view.getViewType()).toBe(PM_SEARCH_VIEW_TYPE);
    });

    it("getDisplayText() returns the panel title", () => {
      const { view } = makeView();
      expect(view.getDisplayText()).toBe(PM_SEARCH_TEXT.TITLE);
    });

    it("getIcon() returns the panel icon", () => {
      const { view } = makeView();
      expect(view.getIcon()).toBe(PM_SEARCH_ICON);
    });
  });

  describe("onOpen() — panel layout", () => {
    it("renders the .pm-search root panel inside contentEl", async () => {
      const { view } = makeView();
      await view.onOpen();
      expect(view.contentEl.querySelector(`.${CSS_CLS.PM_SEARCH}`)).not.toBeNull();
    });

    it("mounts the search box, count row, and results area into the command zone", async () => {
      const { view } = makeView();
      await view.onOpen();
      const cz = view.contentEl.querySelector(`.${CSS_CLS.PM_SEARCH_COMMAND_ZONE}`);
      expect(cz?.querySelector(`.${CSS_CLS.PM_SEARCH_INPUT_FIELD}`)).not.toBeNull();
      expect(cz?.querySelector(`.${CSS_CLS.PM_SEARCH_COUNT}`)).not.toBeNull();
      expect(view.contentEl.querySelector(`.${CSS_CLS.PM_SEARCH_RESULTS}`)).not.toBeNull();
    });

    it("does not register a vault modify listener (settings-backed, no echo)", async () => {
      const { view, plugin } = makeView();
      const vaultOn = vi.spyOn(plugin.app.vault, "on");
      await view.onOpen();
      expect(vaultOn).not.toHaveBeenCalledWith("modify", expect.any(Function));
    });

    it("re-opening rebuilds a single panel rather than stacking duplicates", async () => {
      const { view } = makeView();
      await view.onOpen();
      // render() empties the container first, so a second open replaces the
      // panel rather than appending a second .pm-search root.
      await view.onOpen();
      expect(view.contentEl.querySelectorAll(`.${CSS_CLS.PM_SEARCH}`).length).toBe(1);
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

    it("resolves without throwing", async () => {
      const { view } = makeView();
      await view.onOpen();
      await expect(view.onClose()).resolves.not.toThrow();
    });
  });
});
