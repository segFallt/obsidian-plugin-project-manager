import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, ObsidianApp } from '../helpers/obsidian-app';
import { createTempVault, removeTempVault } from '../helpers/vault-manager';
import { dismissFirstLaunchDialogs } from '../helpers/first-launch';
import { Page } from '@playwright/test';
import { ObsidianWindow } from '../helpers/types';

let vaultPath: string;
let app: ObsidianApp;
let window: Page;

test.beforeAll(async () => {
  vaultPath = createTempVault();
  const launched = await launchObsidian();
  app = launched;
  window = launched.window;

  await dismissFirstLaunchDialogs(window);

  // Wait for Obsidian workspace to be ready
  await window.waitForSelector('.workspace', { timeout: 30_000 });
});

test.afterAll(async () => {
  if (app) await closeObsidian(app);
  if (vaultPath) removeTempVault(vaultPath);
});

test.beforeEach(async () => {
  window = await app.getVaultPage();
});

test('Obsidian launches and workspace renders', async () => {
  expect(window).not.toBeNull();

  const workspace = await window.$('.workspace');
  expect(workspace).not.toBeNull();
});

test('Project Manager plugin is loaded', async () => {
  // Verify plugin is registered via Obsidian's internal API
  const pluginLoaded = await window.evaluate(() => {
    const obsApp = (window as unknown as ObsidianWindow).app;
    return (
      obsApp?.plugins?.enabledPlugins?.has('project-manager') ?? false
    );
  });

  expect(pluginLoaded).toBe(true);
});

test('Project Manager commands are registered', async () => {
  const commands = await window.evaluate(() => {
    const obsApp = (window as unknown as ObsidianWindow).app;
    const allCommands: string[] = Object.keys(obsApp?.commands?.commands ?? {});
    return allCommands.filter((id) => id.startsWith('project-manager:'));
  });

  expect(commands).toContain('project-manager:create-client');
  expect(commands).toContain('project-manager:create-project');
  expect(commands).toContain('project-manager:scaffold-vault');
  // 14 commands total — catches future renames or accidental removals
  expect(commands.length).toBeGreaterThanOrEqual(14);
});
