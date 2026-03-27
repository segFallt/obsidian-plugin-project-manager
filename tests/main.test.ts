import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { App } from "obsidian";
import ProjectManagerPlugin from "@/main";
import { DATAVIEW_PLUGIN_ID, TASKS_PLUGIN_ID } from "@/constants";

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
