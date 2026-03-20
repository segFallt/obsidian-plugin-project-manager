import { Page } from 'playwright';

interface ObsidianWindow extends Window {
  app?: { commands?: { executeCommandById: (id: string) => boolean } };
}

/**
 * Open the command palette, type a query, and select the first matching result.
 *
 * @param window  - The Obsidian window Page
 * @param query   - Text to type in the palette search box
 */
export async function openCommandPalette(window: Page): Promise<void> {
  await window.keyboard.press('Control+P');
  await window.waitForSelector('.prompt', { timeout: 5_000 });
}

export async function selectCommand(
  window: Page,
  query: string,
): Promise<void> {
  await openCommandPalette(window);

  const input = await window.waitForSelector('.prompt-input', {
    timeout: 5_000,
  });
  await input.fill(query);

  // Wait for results to populate
  await window.waitForSelector('.suggestion-item', { timeout: 5_000 });

  // Click first matching result
  await window.click('.suggestion-item.is-selected');
}

/**
 * Execute an Obsidian command directly via the internal API.
 * Faster than the command palette for setup steps — not a realistic user flow.
 */
export async function executeCommandById(
  window: Page,
  commandId: string,
): Promise<void> {
  await window.evaluate((id: string) => {
    (window as ObsidianWindow).app?.commands?.executeCommandById(id);
  }, commandId);
}
