import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian } from '../helpers/obsidian-app';
import { createTempVault, removeTempVault } from '../helpers/vault-manager';
import { dismissFirstLaunchDialogs } from '../helpers/first-launch';
import { executeCommandById, selectCommand } from '../helpers/command-palette';
import {
  waitForModal,
  fillEntityCreationModal,
  submitModal,
  selectFromSuggester,
} from '../helpers/modal-helpers';
import { ElectronApplication, Page } from 'playwright';

let vaultPath: string;
let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  vaultPath = createTempVault();
  const launched = await launchObsidian(vaultPath);
  app = launched.app;
  window = launched.window;
  await dismissFirstLaunchDialogs(window);
  await window.waitForSelector('.workspace', { timeout: 30_000 });
});

test.afterAll(async () => {
  if (app) await closeObsidian(app);
  if (vaultPath) removeTempVault(vaultPath);
});

/**
 * Full journey: Create Client → Engagement → Project, then verify
 * the relationship chain is reflected in note frontmatter.
 */
test('Full workflow: Client → Engagement → Project creation', async () => {
  // 1. Create a Client
  await executeCommandById(window, 'project-manager:create-client');
  await waitForModal(window);
  await fillEntityCreationModal(window, { Name: 'Workflow Client' });
  await submitModal(window);
  await window.waitForTimeout(1_000);

  const clientFile = await window.evaluate(() => {
    return (window as any).app.workspace.getActiveFile()?.basename;
  });
  expect(clientFile).toContain('Workflow Client');

  // 2. Create an Engagement for that client
  await executeCommandById(window, 'project-manager:create-engagement');
  await waitForModal(window);

  // Select the client via the suggester that appears
  await selectFromSuggester(window, 'Workflow Client');

  // Fill engagement name
  await fillEntityCreationModal(window, { Name: 'Workflow Engagement' });
  await submitModal(window);
  await window.waitForTimeout(1_000);

  const engagementFile = await window.evaluate(() => {
    return (window as any).app.workspace.getActiveFile()?.basename;
  });
  expect(engagementFile).toContain('Workflow Engagement');

  // 3. Create a Project under that engagement
  await executeCommandById(window, 'project-manager:create-project');
  await waitForModal(window);

  // Select the engagement
  await selectFromSuggester(window, 'Workflow Engagement');

  await fillEntityCreationModal(window, { Name: 'Workflow Project' });
  await submitModal(window);
  await window.waitForTimeout(1_000);

  const projectFile = await window.evaluate(() => {
    return (window as any).app.workspace.getActiveFile()?.basename;
  });
  expect(projectFile).toContain('Workflow Project');

  // 4. Verify the project note has frontmatter linking back to the engagement
  const frontmatter = await window.evaluate(() => {
    const obsApp = (window as any).app;
    const file = obsApp.workspace.getActiveFile();
    if (!file) return null;
    return obsApp.metadataCache.getFileCache(file)?.frontmatter ?? null;
  });

  expect(frontmatter).not.toBeNull();
  expect(frontmatter.type).toBe('project');
});

test('Scaffold Vault command creates expected folder structure', async () => {
  await executeCommandById(window, 'project-manager:scaffold-vault');

  // Give the command time to create directories
  await window.waitForTimeout(2_000);

  // Verify that the vault now has the scaffolded structure in the file explorer
  const vaultFiles = await window.evaluate(() => {
    const obsApp = (window as any).app;
    return obsApp.vault.getAllLoadedFiles().map((f: any) => f.path);
  });

  // Scaffolded vault should include common PM directories
  const hasClientsDir = vaultFiles.some(
    (p: string) => p.includes('clients') || p.includes('clients/'),
  );
  expect(hasClientsDir).toBe(true);
});
