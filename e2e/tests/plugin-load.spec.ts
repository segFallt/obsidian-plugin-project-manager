import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian } from '../helpers/obsidian-app';
import { createTempVault, removeTempVault } from '../helpers/vault-manager';
import { dismissFirstLaunchDialogs } from '../helpers/first-launch';
import { ElectronApplication } from 'playwright';

interface ObsidianWindow extends Window {
  app?: {
    plugins?: { enabledPlugins?: Set<string> };
    commands?: { commands?: Record<string, unknown> };
  };
}

let vaultPath: string;
let app: ElectronApplication;

test.beforeAll(async () => {
  vaultPath = createTempVault();
  const launched = await launchObsidian(vaultPath);
  app = launched.app;

  await dismissFirstLaunchDialogs(launched.window);

  // Wait for Obsidian workspace to be ready
  await launched.window.waitForSelector('.workspace', { timeout: 30_000 });
});

test.afterAll(async () => {
  if (app) await closeObsidian(app);
  if (vaultPath) removeTempVault(vaultPath);
});

test('Obsidian launches and workspace renders', async () => {
  const windows = app.windows();
  expect(windows.length).toBeGreaterThan(0);

  const window = windows[0];
  const workspace = await window.$('.workspace');
  expect(workspace).not.toBeNull();
});

test('Project Manager plugin is loaded', async () => {
  const window = app.windows()[0];

  // Verify plugin is registered via Obsidian's internal API
  const pluginLoaded = await window.evaluate(() => {
    const obsApp = (window as ObsidianWindow).app;
    return (
      obsApp?.plugins?.enabledPlugins?.has('project-manager') ?? false
    );
  });

  expect(pluginLoaded).toBe(true);
});

test('Project Manager commands are registered', async () => {
  const window = app.windows()[0];

  const commands = await window.evaluate(() => {
    const obsApp = (window as ObsidianWindow).app;
    const allCommands: string[] = Object.keys(obsApp?.commands?.commands ?? {});
    return allCommands.filter((id) => id.startsWith('project-manager:'));
  });

  expect(commands).toContain('project-manager:create-client');
  expect(commands).toContain('project-manager:create-project');
  expect(commands).toContain('project-manager:set-up-vault-structure');
});
