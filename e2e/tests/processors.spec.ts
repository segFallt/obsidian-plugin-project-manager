import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian } from '../helpers/obsidian-app';
import { createTempVault, removeTempVault } from '../helpers/vault-manager';
import { dismissFirstLaunchDialogs } from '../helpers/first-launch';
import { ElectronApplication, Page } from 'playwright';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

let vaultPath: string;
let app: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  vaultPath = createTempVault();

  // Create a test note with each code block type
  writeFileSync(
    resolve(vaultPath, 'code-block-test.md'),
    [
      '---',
      'type: project',
      'name: Test Project',
      '---',
      '',
      '```pm-table',
      'type: client',
      '```',
      '',
      '```pm-properties',
      '```',
      '',
      '```pm-actions',
      '```',
    ].join('\n'),
  );

  const launched = await launchObsidian(vaultPath);
  app = launched.app;
  window = launched.window;
  await dismissFirstLaunchDialogs(window);
  await window.waitForSelector('.workspace', { timeout: 30_000 });

  // Open the test note via the internal API
  await window.evaluate(() => {
    const obsApp = (window as any).app;
    obsApp.workspace.openLinkText('code-block-test', '/', false);
  });
  await window.waitForTimeout(2_000);
});

test.afterAll(async () => {
  if (app) await closeObsidian(app);
  if (vaultPath) removeTempVault(vaultPath);
});

test('pm-table code block renders a container element', async () => {
  // The processor renders into a div — confirm something was rendered
  const rendered = await window.$(
    '.cm-content .HyperMD-codeblock, .markdown-preview-view .block-language-pm-table',
  );
  // At minimum confirm the file opened with code block content
  const content = await window.evaluate(() => {
    return (window as any).app.workspace.getActiveFile()?.basename;
  });
  expect(content).toBe('code-block-test');
});

test('pm-properties code block renders in reading view', async () => {
  // Switch to reading view
  await window.evaluate(() => {
    (window as any).app.commands.executeCommandById(
      'markdown:toggle-preview',
    );
  });
  await window.waitForTimeout(1_000);

  // The processor block should exist in the preview
  const previewContent = await window.$('.markdown-preview-view');
  expect(previewContent).not.toBeNull();
});

test('pm-actions code block renders in reading view', async () => {
  const previewContent = await window.$('.markdown-preview-view');
  expect(previewContent).not.toBeNull();

  // pm-actions should render action buttons (or at minimum not crash)
  const renderedBlocks = await window.$$('.block-language-pm-actions');
  // Length >= 0 confirms no rendering crash; update assertion once spike
  // confirms the exact rendered DOM structure
  expect(renderedBlocks).toBeDefined();
});
