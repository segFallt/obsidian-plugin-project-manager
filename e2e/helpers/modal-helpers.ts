import { Page } from 'playwright';

/**
 * Wait for a modal to appear and return its root element's selector string.
 */
export async function waitForModal(
  window: Page,
  timeout = 10_000,
): Promise<void> {
  await window.waitForSelector('.modal-container .modal', { timeout });
}

/**
 * Dismiss/close the currently open modal by clicking the close button or
 * pressing Escape.
 */
export async function closeModal(window: Page): Promise<void> {
  const closeButton = await window.$('.modal-close-button');
  if (closeButton) {
    await closeButton.click();
  } else {
    await window.keyboard.press('Escape');
  }
  // Wait for modal to disappear
  await window
    .waitForSelector('.modal-container .modal', {
      state: 'detached',
      timeout: 5_000,
    })
    .catch(() => {
      // Modal may not have a detach event — ignore
    });
}

/**
 * Fill a text input inside a modal identified by its placeholder or label.
 *
 * @param window      Obsidian window Page
 * @param placeholder Placeholder text of the input field
 * @param value       Value to type
 */
export async function fillModalInput(
  window: Page,
  placeholder: string,
  value: string,
): Promise<void> {
  const input = await window.waitForSelector(
    `.modal input[placeholder="${placeholder}"], .modal input[aria-label="${placeholder}"]`,
    { timeout: 5_000 },
  );
  await input.fill(value);
}

/**
 * Select an item from a suggester modal (SuggesterModal / fuzzy dropdown)
 * by typing a search string and clicking the first matching result.
 */
export async function selectFromSuggester(
  window: Page,
  query: string,
): Promise<void> {
  // Suggester reuses .prompt for its input
  const input = await window.waitForSelector('.prompt .prompt-input', {
    timeout: 5_000,
  });
  await input.fill(query);
  await window.waitForSelector('.suggestion-item', { timeout: 5_000 });
  await window.click('.suggestion-item.is-selected');
}

/**
 * Click the primary submit / confirm button in the currently open modal.
 * Tries common button labels: "Create", "Confirm", "OK", "Submit".
 */
export async function submitModal(window: Page): Promise<void> {
  const labels = ['Create', 'Confirm', 'OK', 'Submit'];
  for (const label of labels) {
    const button = await window.$(
      `.modal button:has-text("${label}"), .modal-button-container button:has-text("${label}")`,
    );
    if (button) {
      await button.click();
      return;
    }
  }
  // Fallback: press Enter
  await window.keyboard.press('Enter');
}

/**
 * Fill the EntityCreationModal name input fields.
 * Matches each key against the input's `placeholder` attribute (via `input[placeholder="..."]`),
 * NOT by label text. Use the exact placeholder strings defined in the modal source
 * (e.g. "Engagement name", "Project name").
 *
 * Caller must invoke `waitForModal` before calling this function.
 *
 * NOTE: The optional parent `<select>` element is NOT handled here. To select a parent entity,
 * call `page.selectOption('.modal select', parentName)` separately before submitting.
 * The select only renders when Dataview has indexed parent entities — it is absent in a fresh vault.
 */
export async function fillEntityCreationModal(
  window: Page,
  fields: Record<string, string>,
): Promise<void> {
  for (const [placeholder, value] of Object.entries(fields)) {
    await fillModalInput(window, placeholder, value);
  }
}
