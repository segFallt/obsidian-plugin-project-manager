import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test';
import {
  ObsidianSpecContext,
  setupObsidianSpec,
  teardownObsidianSpec,
} from '../helpers/obsidian-spec-setup';
import { selectCommand } from '../helpers/command-palette';
import { ObsidianWindow } from '../helpers/types';
import {
  COMMAND_NAMES,
  CSS_CLS,
  PM_REFERENCE_DASHBOARD_VIEW_TYPE,
  REFERENCES_DASHBOARD_TEXT,
} from '../../src/constants';

/**
 * End-to-end guard for the Reference Dashboard fresh-open path. No spec opened
 * this view before, so a view that threw while constructing was invisible to the
 * whole suite. Opening it and asserting it renders — rather than Obsidian's
 * empty-view placeholder — closes that gap.
 */

/** Selector for the dashboard host content element (present only if the view constructed). */
const DASHBOARD_VIEW_SELECTOR = `.${CSS_CLS.REFERENCE_DASHBOARD_VIEW}`;
/** Selector for the rendered dashboard body. */
const DASHBOARD_BODY_SELECTOR = `${DASHBOARD_VIEW_SELECTOR} .${CSS_CLS.REFERENCES}`;
/** Selector for the dashboard's action buttons. */
const DASHBOARD_ACTION_BUTTON_SELECTOR = `.${CSS_CLS.REFERENCE_DASHBOARD_ACTIONS_BUTTON}`;
/** Selector for the dashboard's view-mode tabs. */
const DASHBOARD_TAB_SELECTOR = `.${CSS_CLS.REFERENCES_TAB}`;

/** Time for the dashboard view to construct and render after activation (ms). */
const DASHBOARD_RENDER_TIMEOUT_MS = 10_000;

/**
 * Obsidian's core empty-view placeholder text, shown when a registered view type
 * fails to construct. The dashboard must never render these.
 */
const PLACEHOLDER_PHRASES = ['Plugin no longer active', 'has gone away'];

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

/**
 * Open the Reference Dashboard from the command palette and wait for its body to
 * render. Idempotent: if a dashboard leaf is already open, activation reveals it.
 * Each test opens the dashboard itself so the tests stay independent of order.
 */
async function openReferenceDashboard(page: Page): Promise<void> {
  await selectCommand(page, COMMAND_NAMES.OPEN_REFERENCE_DASHBOARD);
  // The host content element appears only if the dashboard view constructed
  // without throwing.
  await page.waitForSelector(DASHBOARD_BODY_SELECTOR, {
    timeout: DASHBOARD_RENDER_TIMEOUT_MS,
  });
}

test('opening the Reference Dashboard renders its content, not the placeholder', async () => {
  await openReferenceDashboard(window);

  // Action buttons are present.
  const actionButtonLabels = await window
    .locator(DASHBOARD_ACTION_BUTTON_SELECTOR)
    .allTextContents();
  expect(actionButtonLabels).toContain(REFERENCES_DASHBOARD_TEXT.NEW_REFERENCE);
  expect(actionButtonLabels).toContain(REFERENCES_DASHBOARD_TEXT.NEW_TOPIC);

  // All three view-mode tabs are present.
  const tabLabels = await window.locator(DASHBOARD_TAB_SELECTOR).allTextContents();
  expect(tabLabels).toContain(REFERENCES_DASHBOARD_TEXT.TAB_TOPIC);
  expect(tabLabels).toContain(REFERENCES_DASHBOARD_TEXT.TAB_CLIENT);
  expect(tabLabels).toContain(REFERENCES_DASHBOARD_TEXT.TAB_ENGAGEMENT);

  // Obsidian's empty-view placeholder is not shown inside the dashboard view.
  const viewText = await window.locator(DASHBOARD_VIEW_SELECTOR).innerText();
  for (const phrase of PLACEHOLDER_PHRASES) {
    expect(viewText).not.toContain(phrase);
  }
});

test('the dashboard leaf resolves to the real view, not the empty placeholder', async () => {
  await openReferenceDashboard(window);

  // Stronger guard, following Obsidian's deferred-views guidance: the open leaf
  // reports the dashboard's registered view type. A failed construction resolves
  // the leaf to Obsidian's `empty` view instead, which this catches regardless of
  // build minification (unlike a constructor-name check).
  const leafViewType = await window.evaluate((expectedType: string) => {
    const workspace = (window as unknown as ObsidianWindow).app?.workspace;
    const leaves = workspace?.getLeavesOfType(expectedType) ?? [];
    return leaves[0]?.view?.getViewType() ?? null;
  }, PM_REFERENCE_DASHBOARD_VIEW_TYPE);

  expect(leafViewType).toBe(PM_REFERENCE_DASHBOARD_VIEW_TYPE);
});
