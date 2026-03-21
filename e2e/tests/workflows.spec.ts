import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian } from '../helpers/obsidian-app';
import { createTempVault, removeTempVault } from '../helpers/vault-manager';
import { dismissFirstLaunchDialogs } from '../helpers/first-launch';
import { executeCommandById, selectCommand } from '../helpers/command-palette';
import {
  waitForModal,
  fillModalInput,
  fillEntityCreationModal,
  submitModal,
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
 * Verifies that the Client, Engagement, and Project creation commands each open
 * the correct modal and produce a note with valid frontmatter.
 *
 * NOTE: Parent-child relationship links (client on engagement, engagement on project)
 * are NOT asserted here. EntityCreationModal's parent <select> requires Dataview to
 * have indexed parent entities, which is not possible in a fresh vault.
 * Parent-child relationship chain assertions are tracked in issue #14.
 */
test('Sequential entity creation: Client, Engagement, and Project commands each create a note', async () => {
  // 1. Create a Client
  await executeCommandById(window, 'project-manager:create-client');
  await waitForModal(window);
  await fillModalInput(window, 'e.g. Acme Corp', 'Workflow Client');
  await submitModal(window);
  await window.waitForTimeout(1_000);

  const clientFile = await window.evaluate(() => {
    return (window as any).app.workspace.getActiveFile()?.basename;
  });
  expect(clientFile).toContain('Workflow Client');

  // 2. Create an Engagement for that client
  await executeCommandById(window, 'project-manager:create-engagement');
  await waitForModal(window);

  // Parent selection via <select> is skipped: EntityCreationModal only renders the select when
  // Dataview has indexed parent entities. In a fresh vault there are no indexed clients yet,
  // so the select is absent and parent linkage cannot be set here.
  await fillEntityCreationModal(window, { 'Engagement name': 'Workflow Engagement' });
  await submitModal(window);
  await window.waitForTimeout(1_000);

  const engagementFile = await window.evaluate(() => {
    return (window as any).app.workspace.getActiveFile()?.basename;
  });
  expect(engagementFile).toContain('Workflow Engagement');

  // 3. Create a Project under that engagement
  await executeCommandById(window, 'project-manager:create-project');
  await waitForModal(window);

  // Same as above: parent <select> is absent in a fresh vault; project is created without
  // an engagement link. A separate integration test with Dataview available covers the chain.
  await fillEntityCreationModal(window, { 'Project name': 'Workflow Project' });
  await submitModal(window);
  await window.waitForTimeout(1_000);

  const projectFile = await window.evaluate(() => {
    return (window as any).app.workspace.getActiveFile()?.basename;
  });
  expect(projectFile).toContain('Workflow Project');

  // 4. Verify the project note has the expected project frontmatter fields
  const frontmatter = await window.evaluate(() => {
    const obsApp = (window as any).app;
    const file = obsApp.workspace.getActiveFile();
    if (!file) return null;
    return obsApp.metadataCache.getFileCache(file)?.frontmatter ?? null;
  });

  expect(frontmatter).not.toBeNull();
  // status and #project tag are canonical project identifiers from TEMPLATE_PROJECT
  expect(frontmatter.status).toBe('New');
  expect(frontmatter.tags).toContain('#project');
  // notesDirectory is project-specific — its presence confirms this is a project note
  expect(frontmatter.notesDirectory).toBeTruthy();
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
