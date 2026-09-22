import { expect, Page } from '@playwright/test';
import { selectCommand } from './command-palette';
import { ObsidianWindow } from './types';
import {
  COMMAND_NAMES,
  CSS_CLS,
  PM_REFERENCE_DASHBOARD_VIEW_TYPE,
  REFERENCES_DASHBOARD_TEXT,
} from '../../src/constants';

/**
 * Shared helpers for exercising the Reference Dashboard ItemView end to end,
 * reused by the fresh-open and restart/restore specs.
 */

/** Selector for the dashboard host content element (present only if the view constructed). */
const DASHBOARD_VIEW_SELECTOR = `.${CSS_CLS.REFERENCE_DASHBOARD_VIEW}`;
/** Selector for the rendered dashboard body. */
const DASHBOARD_BODY_SELECTOR = `${DASHBOARD_VIEW_SELECTOR} .${CSS_CLS.REFERENCES}`;
/** Selector for the dashboard's action buttons. */
const DASHBOARD_ACTION_BUTTON_SELECTOR = `.${CSS_CLS.REFERENCE_DASHBOARD_ACTIONS_BUTTON}`;
/** Selector for the dashboard's view-mode tabs. */
const DASHBOARD_TAB_SELECTOR = `.${CSS_CLS.REFERENCES_TAB}`;

/** Time for the dashboard view to construct and render (ms). */
const DASHBOARD_RENDER_TIMEOUT_MS = 10_000;

/**
 * Obsidian's core empty-view placeholder text, shown when a registered view type
 * fails to construct. The dashboard must never render these.
 */
const PLACEHOLDER_PHRASES = ['Plugin no longer active', 'has gone away'];

/**
 * Wait until the dashboard body is present. The host content element appears only
 * if the dashboard view constructed without throwing.
 */
export async function waitForReferenceDashboardRendered(page: Page): Promise<void> {
  await page.waitForSelector(DASHBOARD_BODY_SELECTOR, {
    timeout: DASHBOARD_RENDER_TIMEOUT_MS,
  });
}

/**
 * Open the Reference Dashboard from the command palette and wait for it to render.
 * Idempotent: if a dashboard leaf is already open, activation reveals it.
 */
export async function openReferenceDashboard(page: Page): Promise<void> {
  await selectCommand(page, COMMAND_NAMES.OPEN_REFERENCE_DASHBOARD);
  await waitForReferenceDashboardRendered(page);
}

/**
 * Assert the dashboard rendered its real content — action buttons and all three
 * view-mode tabs — with Obsidian's empty-view placeholder absent.
 */
export async function assertReferenceDashboardRendered(page: Page): Promise<void> {
  const actionButtonLabels = await page
    .locator(DASHBOARD_ACTION_BUTTON_SELECTOR)
    .allTextContents();
  expect(actionButtonLabels).toContain(REFERENCES_DASHBOARD_TEXT.NEW_REFERENCE);
  expect(actionButtonLabels).toContain(REFERENCES_DASHBOARD_TEXT.NEW_TOPIC);

  const tabLabels = await page.locator(DASHBOARD_TAB_SELECTOR).allTextContents();
  expect(tabLabels).toContain(REFERENCES_DASHBOARD_TEXT.TAB_TOPIC);
  expect(tabLabels).toContain(REFERENCES_DASHBOARD_TEXT.TAB_CLIENT);
  expect(tabLabels).toContain(REFERENCES_DASHBOARD_TEXT.TAB_ENGAGEMENT);

  const viewText = await page.locator(DASHBOARD_VIEW_SELECTOR).innerText();
  for (const phrase of PLACEHOLDER_PHRASES) {
    expect(viewText).not.toContain(phrase);
  }
}

/**
 * Assert the open dashboard leaf resolves to the registered dashboard view type.
 * A failed construction resolves the leaf to Obsidian's `empty` view instead,
 * which this catches regardless of build minification (unlike a constructor-name
 * check), following Obsidian's deferred-views guidance.
 */
export async function assertDashboardLeafResolvesToRealView(page: Page): Promise<void> {
  const leafViewType = await page.evaluate((expectedType: string) => {
    const workspace = (window as unknown as ObsidianWindow).app?.workspace;
    const leaves = workspace?.getLeavesOfType(expectedType) ?? [];
    return leaves[0]?.view?.getViewType() ?? null;
  }, PM_REFERENCE_DASHBOARD_VIEW_TYPE);

  expect(leafViewType).toBe(PM_REFERENCE_DASHBOARD_VIEW_TYPE);
}
