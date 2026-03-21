import { Page } from '@playwright/test';
import { ObsidianWindow } from './types';

/**
 * Dismiss any first-launch dialogs Obsidian may show:
 *   1. License / EULA acceptance screen
 *   2. "What's new" / release notes modal
 *   3. Plugin trust / enable confirmation
 *
 * This function is deliberately defensive — it checks for dialogs rather than
 * assuming they will always appear. Exact selectors should be validated and
 * updated during the initial spike.
 *
 * Strategy: pre-seed consent in the config directory so dialogs don't appear
 * at all (see writeObsidianConfig), then dismiss anything that slips through.
 */
export async function dismissFirstLaunchDialogs(window: Page): Promise<void> {
  // Accept EULA if present
  await dismissIfPresent(window, 'button:has-text("Accept")', 'EULA accept');
  await dismissIfPresent(window, 'button:has-text("I Agree")', 'EULA agree');

  // Dismiss "What's new" modal
  await dismissIfPresent(
    window,
    '.modal-close-button',
    "What's new close button",
  );

  // Trust / enable community plugins dialog
  await dismissIfPresent(
    window,
    'button:has-text("Turn on community plugins")',
    'community plugins trust',
  );
  await dismissIfPresent(
    window,
    'button:has-text("Enable")',
    'plugin enable button',
  );

  // Dismiss any remaining modals with an Escape key press
  const hasModal = await window
    .$('.modal-container')
    .then((el) => !!el)
    .catch(() => false);
  if (hasModal) {
    await window.keyboard.press('Escape');
  }

  // Enable and initialize the project-manager plugin programmatically.
  // Clicking the community plugins trust dialog only enables community plugins
  // globally — it does not enable individual plugins. We must call the API directly.
  try {
    await window.evaluate(async () => {
      const obsApp = (window as unknown as ObsidianWindow).app;
      if (obsApp?.plugins) {
        // setEnable() is synchronous — it writes the enabled flag in memory.
        // loadPlugin() is async — it runs onload() and registers commands.
        obsApp.plugins.setEnable('project-manager', true);
        await obsApp.plugins.loadPlugin('project-manager');
      }
    });
  } catch (err) {
    throw new Error(
      `[first-launch] Failed to load project-manager plugin via Obsidian API. ` +
        `This usually means the plugin's onload() threw an error or the Obsidian app object is not ready. ` +
        `Original error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Wait until the plugin's commands are registered — confirms onload() completed.
  await window.waitForFunction(
    () =>
      !!(window as unknown as ObsidianWindow).app?.commands?.commands?.[
        'project-manager:create-client'
      ],
    { timeout: 15_000 },
  );
}

async function dismissIfPresent(
  window: Page,
  selector: string,
  label: string,
): Promise<void> {
  try {
    const element = await window.$(selector);
    if (element) {
      console.log(`[first-launch] Dismissing: ${label}`);
      await element.click();
      await window.waitForTimeout(300);
    }
  } catch {
    // Element not present — ignore
  }
}
