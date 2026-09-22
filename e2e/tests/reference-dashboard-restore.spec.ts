import { test } from '@playwright/test';
import { Page } from '@playwright/test';
import { setupObsidianSpec } from '../helpers/obsidian-spec-setup';
import {
  ObsidianApp,
  closeObsidian,
  relaunchObsidian,
  waitOnLivePage,
} from '../helpers/obsidian-app';
import { dismissFirstLaunchDialogs } from '../helpers/first-launch';
import { removeTempVault } from '../helpers/vault-manager';
import { WORKSPACE_READY_TIMEOUT_MS, WORKSPACE_SELECTOR } from '../helpers/constants';
import {
  assertDashboardLeafResolvesToRealView,
  assertReferenceDashboardRendered,
  openReferenceDashboard,
  waitForReferenceDashboardRendered,
} from '../helpers/reference-dashboard';

/**
 * End-to-end guard for the Reference Dashboard restart/restore path. This covers a
 * different failure mode from the fresh-open guard: a view that opens fine but does
 * not resolve when its saved leaf is restored during layout restore. No spec
 * relaunched Obsidian against a persisted layout before, so this path was untested.
 */

/** The current Obsidian instance — reassigned across the relaunch so teardown closes the live one. */
let app: ObsidianApp;
let vaultPath: string;

test.beforeAll(async () => {
  const ctx = await setupObsidianSpec();
  app = ctx.app;
  vaultPath = ctx.vaultPath;
});

test.afterAll(async () => {
  if (app) await closeObsidian(app);
  if (vaultPath) removeTempVault(vaultPath);
});

test('a persisted dashboard tab renders after a relaunch', async () => {
  // Open the dashboard so a pm-reference-dashboard leaf is part of the layout.
  const initialPage = await app.getVaultPage();
  await openReferenceDashboard(initialPage);

  // Persist the layout, quit, and relaunch against the same vault and config dir.
  app = await relaunchObsidian(app, vaultPath);

  // Let the restored session settle, dismissing any dialogs, then re-acquire the
  // live page (the relaunch replaces the renderer, invalidating earlier pages).
  await waitOnLivePage(app, (page: Page) =>
    page.waitForSelector(WORKSPACE_SELECTOR, { timeout: WORKSPACE_READY_TIMEOUT_MS }),
  );
  await dismissFirstLaunchDialogs(await app.getVaultPage());
  const restoredPage = await app.getVaultPage();

  // The restored tab renders the dashboard, not the "plugin has gone away" placeholder.
  await waitForReferenceDashboardRendered(restoredPage);
  await assertReferenceDashboardRendered(restoredPage);
  await assertDashboardLeafResolvesToRealView(restoredPage);
});
