import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test';
import {
  ObsidianSpecContext,
  setupObsidianSpec,
  teardownObsidianSpec,
} from '../helpers/obsidian-spec-setup';

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

async function openSettings(win: Page): Promise<void> {
  await win.evaluate(() => {
    (window as any).app.commands.executeCommandById('app:open-settings');
  });
  await win.waitForSelector('.modal-container .modal.mod-settings', {
    timeout: 10_000,
  });
}

async function navigateToPluginSettings(win: Page): Promise<void> {
  await openSettings(win);

  // Click the Project Manager settings tab in the sidebar
  const tab = await win.waitForSelector(
    '.vertical-tab-nav-item:has-text("Project Manager")',
    { timeout: 5_000 },
  );
  await tab.click();
}

test('Settings modal opens', async () => {
  await openSettings(window);

  const modal = await window.$('.modal.mod-settings');
  expect(modal).not.toBeNull();

  await window.keyboard.press('Escape');
});

test('Project Manager settings tab is present', async () => {
  await openSettings(window);

  const tab = await window.$('.vertical-tab-nav-item:has-text("Project Manager")');
  expect(tab).not.toBeNull();

  await window.keyboard.press('Escape');
});

test('Project Manager settings tab renders content', async () => {
  await navigateToPluginSettings(window);

  // Settings content pane should be visible
  const content = await window.$('.vertical-tab-content');
  expect(content).not.toBeNull();

  const text = await content!.textContent();
  // Should contain some project-manager-specific settings text
  expect(text).toBeTruthy();

  await window.keyboard.press('Escape');
});
