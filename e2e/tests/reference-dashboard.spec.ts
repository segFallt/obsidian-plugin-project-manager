import { test } from '@playwright/test';
import { Page } from '@playwright/test';
import {
  ObsidianSpecContext,
  setupObsidianSpec,
  teardownObsidianSpec,
} from '../helpers/obsidian-spec-setup';
import {
  assertDashboardLeafResolvesToRealView,
  assertReferenceDashboardRendered,
  openReferenceDashboard,
} from '../helpers/reference-dashboard';

/**
 * End-to-end guard for the Reference Dashboard fresh-open path. No spec opened
 * this view before, so a view that threw while constructing was invisible to the
 * whole suite. Opening it and asserting it renders — rather than Obsidian's
 * empty-view placeholder — closes that gap.
 */

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

test('opening the Reference Dashboard renders its content, not the placeholder', async () => {
  await openReferenceDashboard(window);
  await assertReferenceDashboardRendered(window);
});

test('the dashboard leaf resolves to the real view, not the empty placeholder', async () => {
  await openReferenceDashboard(window);
  await assertDashboardLeafResolvesToRealView(window);
});
