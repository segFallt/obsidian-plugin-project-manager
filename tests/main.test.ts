import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { App } from "obsidian";
import ProjectManagerPlugin from "@/main";
import { DATAVIEW_PLUGIN_ID, TASKS_PLUGIN_ID } from "@/constants";
import { ReferenceDashboardItemView } from "@/views";

// ─── Mock Notice ──────────────────────────────────────────────────────────────
// vi.hoisted ensures the factory function runs before module-level imports,
// so the spy is in place when main.ts resolves its `Notice` binding.

const { MockNotice } = vi.hoisted(() => ({
  MockNotice: vi.fn(),
}));

vi.mock("obsidian", async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return { ...mod, Notice: MockNotice };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

type PluginsHost = {
  plugins: { plugins: Record<string, { api?: unknown } | undefined> };
};

/**
 * Build a mock App with the specified plugin IDs registered in the plugins
 * registry. Dataview gets an `.api` object; all others get an empty object.
 */
function buildApp(registeredIds: string[]) {
  const app = new App();
  const registry: Record<string, { api?: unknown } | undefined> = {};
  for (const id of registeredIds) {
    registry[id] = id === DATAVIEW_PLUGIN_ID ? { api: { pages: vi.fn() } } : {};
  }
  (app as unknown as PluginsHost).plugins.plugins = registry;
  return app;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type CommandDef = { id: string; name: string; callback?: () => void };

/**
 * Builds an app with both required plugins registered and workspace spies
 * wired up for testing activateReferenceDashboard.
 */
function buildAppWithWorkspaceSpy() {
  const app = buildApp([DATAVIEW_PLUGIN_ID, TASKS_PLUGIN_ID]);

  const mockLeaf = {
    setViewState: vi.fn().mockResolvedValue(undefined),
  };
  const getLeafSpy = vi.fn().mockReturnValue(mockLeaf);
  const getLeavesOfTypeSpy = vi.fn().mockReturnValue([]);
  const revealLeafSpy = vi.fn();

  app.workspace.getLeaf = getLeafSpy as unknown as typeof app.workspace.getLeaf;
  app.workspace.getLeavesOfType = getLeavesOfTypeSpy as unknown as typeof app.workspace.getLeavesOfType;
  app.workspace.revealLeaf = revealLeafSpy as unknown as typeof app.workspace.revealLeaf;

  return { app, mockLeaf, getLeafSpy, getLeavesOfTypeSpy, revealLeafSpy };
}

/**
 * Loads the plugin, captures the open-reference-dashboard command callback,
 * and returns it alongside the workspace spies.
 */
async function loadPluginAndGetDashboardCommand(app: App) {
  const plugin = new ProjectManagerPlugin(app, {} as never);

  let openDashboardCallback: (() => void) | undefined;
  const originalAddCommand = plugin.addCommand.bind(plugin);
  plugin.addCommand = (command: CommandDef) => {
    if (command.id === "open-reference-dashboard") {
      openDashboardCallback = command.callback;
    }
    return originalAddCommand(command);
  };

  await plugin.onload();

  return { plugin, openDashboardCallback };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ProjectManagerPlugin — startup dependency checks", () => {
  let plugin: ProjectManagerPlugin;

  beforeEach(() => {
    MockNotice.mockClear();
  });

  afterEach(() => {
    // Clean up the LoggerService flush interval created during initServices().
    plugin?.onunload();
  });

  it("shows a Notice for each missing plugin when neither is installed", async () => {
    plugin = new ProjectManagerPlugin(buildApp([]), {} as never);
    await plugin.onload();

    const messages = MockNotice.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes("Dataview"))).toBe(true);
    expect(messages.some((m) => m.includes("Tasks"))).toBe(true);
  });

  it("shows only the Dataview Notice when Tasks is present (Dataview absent)", async () => {
    plugin = new ProjectManagerPlugin(buildApp([TASKS_PLUGIN_ID]), {} as never);
    await plugin.onload();

    const messages = MockNotice.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes("Dataview"))).toBe(true);
    expect(messages.some((m) => m.includes("Tasks"))).toBe(false);
  });

  it("shows only the Tasks Notice when Dataview is present (Tasks absent)", async () => {
    plugin = new ProjectManagerPlugin(buildApp([DATAVIEW_PLUGIN_ID]), {} as never);
    await plugin.onload();

    const messages = MockNotice.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes("Dataview"))).toBe(false);
    expect(messages.some((m) => m.includes("Tasks"))).toBe(true);
  });

  it("shows no dependency Notices when both plugins are installed", async () => {
    plugin = new ProjectManagerPlugin(buildApp([DATAVIEW_PLUGIN_ID, TASKS_PLUGIN_ID]), {} as never);
    await plugin.onload();

    const messages = MockNotice.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes("Dataview") || m.includes("Tasks"))).toBe(false);
  });
});

describe("activateReferenceDashboard", () => {
  let plugin: ProjectManagerPlugin;

  afterEach(() => {
    plugin?.onunload();
  });

  it("calls getLeaf('tab'), setViewState, and revealLeaf when no existing view is open", async () => {
    const { app, mockLeaf, getLeafSpy, getLeavesOfTypeSpy, revealLeafSpy } =
      buildAppWithWorkspaceSpy();

    // No existing leaves
    getLeavesOfTypeSpy.mockReturnValue([]);

    const { plugin: p, openDashboardCallback } = await loadPluginAndGetDashboardCommand(app);
    plugin = p;

    expect(openDashboardCallback).toBeDefined();
    openDashboardCallback!();

    // Flush the microtask queue: the async callback awaits setViewState before
    // calling revealLeaf, so we need multiple ticks to let all promises settle.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getLeafSpy).toHaveBeenCalledWith("tab");
    expect(mockLeaf.setViewState).toHaveBeenCalledWith({
      type: ReferenceDashboardItemView.VIEW_TYPE,
      active: true,
    });
    expect(revealLeafSpy).toHaveBeenCalledWith(mockLeaf);
  });

  it("reveals the existing leaf and does not call getLeaf when the view is already open", async () => {
    const { app, getLeafSpy, getLeavesOfTypeSpy, revealLeafSpy } = buildAppWithWorkspaceSpy();

    const existingLeaf = { setViewState: vi.fn() };
    // Simulate view already open
    getLeavesOfTypeSpy.mockReturnValue([existingLeaf]);

    const { plugin: p, openDashboardCallback } = await loadPluginAndGetDashboardCommand(app);
    plugin = p;

    expect(openDashboardCallback).toBeDefined();
    openDashboardCallback!();

    // Flush the microtask queue to let the void async callback settle.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getLeafSpy).not.toHaveBeenCalled();
    expect(revealLeafSpy).toHaveBeenCalledWith(existingLeaf);
  });
});
