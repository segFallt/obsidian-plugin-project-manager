import { describe, it, expect, vi, afterEach } from "vitest";
import { TFile } from "obsidian";
import { DashboardRenderChild } from "../../src/processors/dashboard-render-child";
import type {
  DashboardRenderChildConfig,
  DashboardViewComponent,
} from "../../src/processors/dashboard-render-child";
import type { ViewState, ViewStateStore } from "../../src/processors/view-state-store";

afterEach(() => {
  vi.useRealTimers();
});

interface Harness {
  child: DashboardRenderChild;
  view: DashboardViewComponent & {
    render: ReturnType<typeof vi.fn>;
    refreshOutput: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  };
  store: ViewStateStore & { isOwnWrite: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  fireModify: (file: TFile) => void;
  capturedPersist: () => (state: ViewState | null) => void;
  readModifiedState: ReturnType<typeof vi.fn>;
}

function makeHarness(isOwnWrite = false): Harness {
  const view = {
    render: vi.fn(),
    refreshOutput: vi.fn(),
    destroy: vi.fn(),
  };

  const store = {
    load: vi.fn(() => null),
    save: vi.fn(async () => {}),
    isOwnWrite: vi.fn(() => isOwnWrite),
  } as unknown as ViewStateStore & {
    isOwnWrite: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  let modifyHandler: ((file: TFile) => void) | null = null;
  let persist: (state: ViewState | null) => void = () => {};
  const readModifiedState = vi.fn(() => null);

  const config: DashboardRenderChildConfig = {
    createView: (p) => {
      persist = p;
      return view;
    },
    store,
    stateKey: "pm-tasks-filters",
    readModifiedState,
    registerModify: (handler) => {
      modifyHandler = handler;
      return { id: "mock-event" };
    },
  };

  const containerEl = document.createElement("div");
  const child = new DashboardRenderChild(containerEl, config);

  return {
    child,
    view,
    store,
    fireModify: (file) => modifyHandler?.(file),
    capturedPersist: () => persist,
    readModifiedState,
  };
}

describe("DashboardRenderChild", () => {
  it("mounts the view component on render()", () => {
    const h = makeHarness();
    h.child.render();
    expect(h.view.render).toHaveBeenCalledTimes(1);
  });

  it("registers a modify listener on onload()", () => {
    const h = makeHarness();
    h.child.render();
    // registerModify is invoked during onload; firing proves the handler is wired.
    h.child.onload();
    expect(() => h.fireModify(new TFile("note.md"))).not.toThrow();
  });

  it("refreshes the view (debounced) on an external, non-own vault modify", () => {
    vi.useFakeTimers();
    const h = makeHarness(false);
    h.child.render();
    h.child.onload();

    h.fireModify(new TFile("other.md"));
    expect(h.view.refreshOutput).not.toHaveBeenCalled(); // debounced
    vi.runAllTimers();
    expect(h.view.refreshOutput).toHaveBeenCalledTimes(1);
    expect(h.store.isOwnWrite).toHaveBeenCalled();
  });

  it("suppresses the refresh when the modify is this dashboard's own write-echo", () => {
    vi.useFakeTimers();
    const h = makeHarness(true);
    h.child.render();
    h.child.onload();

    h.fireModify(new TFile("note.md"));
    vi.runAllTimers();
    expect(h.view.refreshOutput).not.toHaveBeenCalled();
  });

  it("persists through the store (debounced) when the view calls persist", () => {
    vi.useFakeTimers();
    const h = makeHarness();
    h.child.render();

    const state: ViewState = { viewMode: "priority" };
    h.capturedPersist()(state);
    expect(h.store.save).not.toHaveBeenCalled(); // debounced
    vi.runAllTimers();
    expect(h.store.save).toHaveBeenCalledWith("pm-tasks-filters", state);
  });

  it("cancels a pending refresh and destroys the view on onunload()", () => {
    vi.useFakeTimers();
    const h = makeHarness(false);
    h.child.render();
    h.child.onload();

    h.fireModify(new TFile("other.md")); // schedule a refresh
    h.child.onunload();
    vi.runAllTimers();

    expect(h.view.refreshOutput).not.toHaveBeenCalled(); // cancelled
    expect(h.view.destroy).toHaveBeenCalledTimes(1);
  });
});
