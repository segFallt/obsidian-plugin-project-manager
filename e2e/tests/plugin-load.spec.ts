import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test';
import {
  ObsidianSpecContext,
  setupObsidianSpec,
  teardownObsidianSpec,
} from '../helpers/obsidian-spec-setup';
import {
  COMMAND_PREFIX,
  CREATE_CLIENT_COMMAND_ID,
  CREATE_PROJECT_COMMAND_ID,
  MIN_REGISTERED_COMMAND_COUNT,
  PLUGIN_ID,
  SCAFFOLD_VAULT_COMMAND_ID,
} from '../helpers/constants';
import { ObsidianWindow } from '../helpers/types';

let ctx: ObsidianSpecContext;
let window: Page;

test.beforeAll(async () => {
  ctx = await setupObsidianSpec();
  window = await ctx.getPage();
});

test.afterAll(async () => {
  await teardownObsidianSpec(ctx);
});

test.beforeEach(async () => {
  window = await ctx.getPage();
});

test('Obsidian launches and workspace renders', async () => {
  expect(window).not.toBeNull();

  const workspace = await window.$('.workspace');
  expect(workspace).not.toBeNull();
});

test('Project Manager plugin is loaded', async () => {
  // Verify plugin is registered via Obsidian's internal API
  const pluginLoaded = await window.evaluate((pluginId: string) => {
    const obsApp = (window as unknown as ObsidianWindow).app;
    return obsApp?.plugins?.enabledPlugins?.has(pluginId) ?? false;
  }, PLUGIN_ID);

  expect(pluginLoaded).toBe(true);
});

test('Project Manager commands are registered', async () => {
  const commands = await window.evaluate((prefix: string) => {
    const obsApp = (window as unknown as ObsidianWindow).app;
    const allCommands: string[] = Object.keys(obsApp?.commands?.commands ?? {});
    return allCommands.filter((id) => id.startsWith(prefix));
  }, COMMAND_PREFIX);

  expect(commands).toContain(CREATE_CLIENT_COMMAND_ID);
  expect(commands).toContain(CREATE_PROJECT_COMMAND_ID);
  expect(commands).toContain(SCAFFOLD_VAULT_COMMAND_ID);
  // Catches future renames or accidental removals
  expect(commands.length).toBeGreaterThanOrEqual(MIN_REGISTERED_COMMAND_COUNT);
});
