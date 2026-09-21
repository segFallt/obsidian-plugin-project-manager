import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test';
import {
  ObsidianSpecContext,
  setupObsidianSpec,
  teardownObsidianSpec,
} from '../helpers/obsidian-spec-setup';
import {
  PLUGIN_ID,
  PLUGIN_NAME,
  SETTING_ITEM_SELECTOR,
  SETTINGS_HEADING_MAIN,
  SETTINGS_HEADING_FOLDER_PATHS,
  SETTINGS_HEADING_SELECTOR,
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

test('Plugin registers its settings tab under the manifest id', async () => {
  const tabIds = await window.evaluate(() => {
    const setting = (window as unknown as ObsidianWindow).app?.setting;
    return setting?.pluginTabs.map((tab) => tab.id) ?? [];
  });

  expect(tabIds).toContain(PLUGIN_ID);
});

test('Registered settings tab carries the plugin manifest name', async () => {
  const tabName = await window.evaluate((pluginId: string) => {
    const setting = (window as unknown as ObsidianWindow).app?.setting;
    return setting?.pluginTabs.find((tab) => tab.id === pluginId)?.name ?? null;
  }, PLUGIN_ID);

  expect(tabName).toBe(PLUGIN_NAME);
});

test('Settings tab renders its content', async () => {
  const rendered = await window.evaluate(
    ({ pluginId, itemSelector, headingSelector }) => {
      const setting = (window as unknown as ObsidianWindow).app?.setting;
      const tab = setting?.pluginTabs.find((candidate) => candidate.id === pluginId);
      if (!tab) return null;

      tab.display();
      const { containerEl } = tab;
      return {
        settingItemCount: containerEl.querySelectorAll(itemSelector).length,
        headings: Array.from(containerEl.querySelectorAll(headingSelector)).map(
          (heading) => heading.textContent ?? '',
        ),
      };
    },
    {
      pluginId: PLUGIN_ID,
      itemSelector: SETTING_ITEM_SELECTOR,
      headingSelector: SETTINGS_HEADING_SELECTOR,
    },
  );

  expect(rendered).not.toBeNull();
  expect(rendered!.settingItemCount).toBeGreaterThan(0);
  expect(rendered!.headings).toContain(SETTINGS_HEADING_MAIN);
  expect(rendered!.headings).toContain(SETTINGS_HEADING_FOLDER_PATHS);
});
