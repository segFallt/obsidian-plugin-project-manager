import { Page } from '@playwright/test';
import { ObsidianWindow } from './types';
import { LivePageProvider, waitOnLivePage } from './obsidian-app';
import {
  CREATE_CLIENT_COMMAND_ID,
  DIALOG_DISMISS_SETTLE_MS,
  PLUGIN_ID,
  PLUGIN_READY_TIMEOUT_MS,
} from './constants';

/**
 * Dismiss any first-launch dialogs Obsidian may show:
 *   1. License / EULA acceptance screen
 *   2. "What's new" / release notes modal
 *   3. Plugin trust / enable confirmation
 *
 * Deliberately defensive — it checks for each dialog rather than assuming it
 * always appears. Consent is pre-seeded in the config directory (see
 * writeObsidianConfig); this dismisses anything that slips through.
 */
export async function dismissFirstLaunchDialogs(page: Page): Promise<void> {
  // Accept EULA if present
  await dismissIfPresent(page, 'button:has-text("Accept")', 'EULA accept');
  await dismissIfPresent(page, 'button:has-text("I Agree")', 'EULA agree');

  // Dismiss "What's new" modal
  await dismissIfPresent(page, '.modal-close-button', "What's new close button");

  // Trust / enable community plugins dialog
  await dismissIfPresent(
    page,
    'button:has-text("Turn on community plugins")',
    'community plugins trust',
  );
  await dismissIfPresent(page, 'button:has-text("Enable")', 'plugin enable button');

  // Dismiss any remaining modals with an Escape key press
  const hasModal = await page
    .$('.modal-container')
    .then((el) => !!el)
    .catch(() => false);
  if (hasModal) {
    await page.keyboard.press('Escape');
  }
}

/**
 * Enable and load the plugin via Obsidian's internal API.
 *
 * Clicking the community-plugins trust dialog only enables community plugins
 * globally — it does not enable individual plugins. `setEnable` writes the
 * enabled flag synchronously; `loadPlugin` runs the plugin's onload() and
 * registers its commands.
 */
export async function enableProjectManagerPlugin(page: Page): Promise<void> {
  try {
    await page.evaluate(async (pluginId: string) => {
      const obsApp = (window as unknown as ObsidianWindow).app;
      if (obsApp?.plugins) {
        obsApp.plugins.setEnable(pluginId, true);
        await obsApp.plugins.loadPlugin(pluginId);
      }
    }, PLUGIN_ID);
  } catch (err) {
    throw new Error(
      `[first-launch] Failed to load the '${PLUGIN_ID}' plugin via Obsidian API. ` +
        `This usually means the plugin's onload() threw an error or the Obsidian app object is not ready. ` +
        `Original error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Wait until the plugin's commands are registered — confirms onload() completed.
 *
 * Runs the wait on the current live page, re-acquiring it if a renderer
 * replacement (e.g. Dataview's first load) closes the page mid-wait.
 */
export async function awaitPluginCommandsRegistered(
  provider: LivePageProvider,
): Promise<void> {
  await waitOnLivePage(provider, (page) =>
    page.waitForFunction(
      (commandId: string) =>
        !!(window as unknown as ObsidianWindow).app?.commands?.commands?.[commandId],
      CREATE_CLIENT_COMMAND_ID,
      { timeout: PLUGIN_READY_TIMEOUT_MS },
    ),
  );
}

async function dismissIfPresent(
  page: Page,
  selector: string,
  label: string,
): Promise<void> {
  try {
    const element = await page.$(selector);
    if (element) {
      console.log(`[first-launch] Dismissing: ${label}`);
      await element.click();
      await page.waitForTimeout(DIALOG_DISMISS_SETTLE_MS);
    }
  } catch {
    // Element not present — nothing to dismiss.
  }
}
