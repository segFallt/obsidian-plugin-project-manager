import { describe, it, expect, vi, afterEach } from "vitest";
import type { WorkspaceLeaf } from "obsidian";
import { DashboardItemViewHost } from "@/processors/dashboard-item-view-host";
import type { DashboardItemViewConfig } from "@/processors/dashboard-item-view-host";
import type { DashboardViewComponent } from "@/processors/dashboard-render-child";
import type { ViewState, ViewStateStore } from "@/processors/view-state-store";

const TEST_VIEW_TYPE = "pm-test-dashboard";
const TEST_DISPLAY_TEXT = "Test Dashboard";
const TEST_ICON = "layout-dashboard";

/**
 * Concrete host used by the tests. The base host's view-identity getters are
 * abstract; this double implements them from constants that read no
 * post-`super()` state, matching how real hosts satisfy the contract.
 */
class TestDashboardItemViewHost extends DashboardItemViewHost {
  getViewType(): string {
    return TEST_VIEW_TYPE;
  }
  getDisplayText(): string {
    return TEST_DISPLAY_TEXT;
  }
  getIcon(): string {
    return TEST_ICON;
  }
}

afterEach(() => {
  vi.useRealTimers();
});

function makeHost(): {
  host: DashboardItemViewHost;
  view: DashboardViewComponent & {
    render: ReturnType<typeof vi.fn>;
    refreshOutput: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  store: ViewStateStore & { save: ReturnType<typeof vi.fn> };
  capturedPersist: () => (state: ViewState | null) => void;
  capturedContainer: () => HTMLElement | null;
} {
  const view = {
    render: vi.fn(),
    refreshOutput: vi.fn(),
    destroy: vi.fn(),
  };

  const store = {
    load: vi.fn(() => null),
    save: vi.fn(async () => {}),
    isOwnWrite: vi.fn(() => false),
  } as unknown as ViewStateStore & { save: ReturnType<typeof vi.fn> };

  let persist: (state: ViewState | null) => void = () => {};
  let container: HTMLElement | null = null;

  const config: DashboardItemViewConfig = {
    store,
    stateKey: "pm-test-filters",
    createView: (p, c) => {
      persist = p;
      container = c;
      return view;
    },
  };

  const host = new TestDashboardItemViewHost({} as WorkspaceLeaf, config);
  return {
    host,
    view,
    store,
    capturedPersist: () => persist,
    capturedContainer: () => container,
  };
}

describe("DashboardItemViewHost", () => {
  it("constructs without throwing when the base ctor queries the view type", () => {
    // The obsidian mock's ItemView ctor calls this.getViewType() during super()
    // (the Obsidian 1.7.2 contract). A subclass whose getters read post-super()
    // state would throw here; a constant-returning double must not.
    expect(() => makeHost()).not.toThrow();
  });

  it("exposes the subclass view metadata", () => {
    const { host } = makeHost();
    expect(host.getViewType()).toBe(TEST_VIEW_TYPE);
    expect(host.getDisplayText()).toBe(TEST_DISPLAY_TEXT);
    expect(host.getIcon()).toBe(TEST_ICON);
  });

  it("mounts the view into contentEl on onOpen()", async () => {
    const { host, view, capturedContainer } = makeHost();
    await host.onOpen();
    expect(view.render).toHaveBeenCalledTimes(1);
    expect(capturedContainer()).toBe(host.contentEl);
  });

  it("tears down cleanly on onClose()", async () => {
    const { host, view } = makeHost();
    await host.onOpen();
    host.contentEl.createEl("span", { text: "content" });
    expect(host.contentEl.childElementCount).toBeGreaterThan(0);

    await host.onClose();
    expect(view.destroy).toHaveBeenCalledTimes(1);
    expect(host.contentEl.childElementCount).toBe(0);
  });

  it("persists through the store (debounced) when the view calls persist", async () => {
    vi.useFakeTimers();
    const { host, store, capturedPersist } = makeHost();
    await host.onOpen();

    const state: ViewState = { viewMode: "topic" };
    capturedPersist()(state);
    expect(store.save).not.toHaveBeenCalled(); // debounced
    vi.runAllTimers();
    expect(store.save).toHaveBeenCalledWith("pm-test-filters", state);
  });

  it("cancels a pending persist on onClose()", async () => {
    vi.useFakeTimers();
    const { host, store, capturedPersist } = makeHost();
    await host.onOpen();

    capturedPersist()({ viewMode: "topic" });
    await host.onClose();
    vi.runAllTimers();
    expect(store.save).not.toHaveBeenCalled(); // cancelled before it fired
  });
});
