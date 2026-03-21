import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian } from '../helpers/obsidian-app';
import { createTempVault, removeTempVault } from '../helpers/vault-manager';
import { dismissFirstLaunchDialogs } from '../helpers/first-launch';
import { executeCommandById, selectCommand } from '../helpers/command-palette';
import {
  waitForModal,
  fillModalInput,
  submitModal,
  closeModal,
} from '../helpers/modal-helpers';
import { Page } from '@playwright/test';
import { ObsidianApp } from '../helpers/obsidian-app';

let vaultPath: string;
let app: ObsidianApp;
let window: Page;

test.beforeAll(async () => {
  vaultPath = createTempVault();
  const launched = await launchObsidian();
  app = launched;
  window = launched.window;
  await dismissFirstLaunchDialogs(window);
  await window.waitForSelector('.workspace', { timeout: 30_000 });
});

test.afterAll(async () => {
  if (app) await closeObsidian(app);
  if (vaultPath) removeTempVault(vaultPath);
});

test('Create Client command opens EntityCreationModal', async () => {
  await executeCommandById(window, 'project-manager:create-client');
  await waitForModal(window);

  const modal = await window.$('.modal');
  expect(modal).not.toBeNull();

  await closeModal(window);
});

test('Create Client via command palette creates a note', async () => {
  await selectCommand(window, 'Create Client');
  await waitForModal(window);

  await fillModalInput(window, 'e.g. Acme Corp', 'Test Client E2E');
  await submitModal(window);

  // Verify note was created — the active file should reference the client
  await window.waitForTimeout(1_000);
  const activeFile = await window.evaluate(() => {
    return (window as any).app.workspace.getActiveFile()?.basename;
  });
  expect(activeFile).toContain('Test Client E2E');
});

test('Create Engagement command opens modal', async () => {
  await executeCommandById(window, 'project-manager:create-engagement');
  await waitForModal(window);

  const modal = await window.$('.modal');
  expect(modal).not.toBeNull();

  await closeModal(window);
});

test('Create Project command opens modal', async () => {
  await executeCommandById(window, 'project-manager:create-project');
  await waitForModal(window);

  const modal = await window.$('.modal');
  expect(modal).not.toBeNull();

  await closeModal(window);
});

test('Scaffold Vault command is registered', async () => {
  const commands = await window.evaluate(() => {
    const obsApp = (window as any).app;
    return Object.keys(obsApp?.commands?.commands ?? {}).filter((id) =>
      id.startsWith('project-manager:'),
    );
  });

  expect(commands).toContain('project-manager:scaffold-vault');
});
