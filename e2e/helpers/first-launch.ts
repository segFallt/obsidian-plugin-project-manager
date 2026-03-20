import { Page } from 'playwright';

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
