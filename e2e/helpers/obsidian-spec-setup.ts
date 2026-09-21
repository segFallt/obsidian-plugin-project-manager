import { Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  ObsidianApp,
  closeObsidian,
  launchObsidian,
  waitOnLivePage,
} from './obsidian-app';
import { createTempVault, removeTempVault } from './vault-manager';
import {
  awaitPluginCommandsRegistered,
  dismissFirstLaunchDialogs,
  enableProjectManagerPlugin,
} from './first-launch';
import {
  FILE_ENCODING,
  PLUGIN_ID,
  WORKSPACE_READY_TIMEOUT_MS,
  WORKSPACE_SELECTOR,
} from './constants';
import { ObsidianWindow } from './types';

/** Absolute path to the built plugin manifest — the runtime source of truth for the plugin id. */
const BUILT_MANIFEST_PATH = resolve(__dirname, '..', '..', 'manifest.json');

/** Handle returned by {@link setupObsidianSpec}, passed back to {@link teardownObsidianSpec}. */
export interface ObsidianSpecContext {
  app: ObsidianApp;
  vaultPath: string;
  /** Re-acquire the current live renderer page. */
  getPage(): Promise<Page>;
}

/** Options for specs that need to seed extra fixture content before Obsidian launches. */
export interface SetupObsidianSpecOptions {
  /** Runs against the freshly created temp vault directory before launch. */
  seedVault?: (vaultPath: string) => void;
}

/**
 * The single, resilient suite-setup path shared by every spec.
 *
 * Composes, in order: create temp vault → (optional seed) → launch Obsidian →
 * dismiss first-launch dialogs → enable + load the plugin → wait for command
 * registration → wait for the workspace to render. The command-registration and
 * workspace waits both run through the live-page resilience helper, so a renderer
 * replacement during setup is recovered rather than fatal.
 *
 * Guards: fails loudly if setup ends with a closed page, or if the enabled plugin
 * id no longer matches the built manifest id.
 */
export async function setupObsidianSpec(
  options: SetupObsidianSpecOptions = {},
): Promise<ObsidianSpecContext> {
  const vaultPath = createTempVault();
  options.seedVault?.(vaultPath);

  const app = await launchObsidian();

  await dismissFirstLaunchDialogs(app.window);
  await enableProjectManagerPlugin(app.window);
  await awaitPluginCommandsRegistered(app);
  await waitOnLivePage(app, (page) =>
    page.waitForSelector(WORKSPACE_SELECTOR, { timeout: WORKSPACE_READY_TIMEOUT_MS }),
  );

  const livePage = await app.getVaultPage();
  if (livePage.isClosed()) {
    throw new Error(
      'setupObsidianSpec: the live page is closed after plugin load — renderer re-acquire regressed.',
    );
  }
  await assertEnabledPluginMatchesManifest(livePage);

  return {
    app,
    vaultPath,
    getPage: () => app.getVaultPage(),
  };
}

/** Close Obsidian and remove the temp vault. Safe to call with an undefined context. */
export async function teardownObsidianSpec(
  context: ObsidianSpecContext | undefined,
): Promise<void> {
  if (!context) return;
  if (context.app) await closeObsidian(context.app);
  if (context.vaultPath) removeTempVault(context.vaultPath);
}

/**
 * Assert the harness id and the actually-enabled plugin both match the built
 * manifest id, so a future rename fails setup with a clear diagnostic instead of
 * silently timing out on a command that can never register.
 */
async function assertEnabledPluginMatchesManifest(page: Page): Promise<void> {
  const manifest = JSON.parse(readFileSync(BUILT_MANIFEST_PATH, FILE_ENCODING)) as {
    id?: string;
  };
  const manifestId = manifest.id;
  if (!manifestId) {
    throw new Error(
      `setupObsidianSpec: the built manifest at ${BUILT_MANIFEST_PATH} has no 'id' field.`,
    );
  }
  if (manifestId !== PLUGIN_ID) {
    throw new Error(
      `setupObsidianSpec: harness PLUGIN_ID '${PLUGIN_ID}' no longer matches the built manifest id '${manifestId}'. ` +
        `Update e2e/helpers/constants.ts and the fixtures' community-plugins.json to the new id.`,
    );
  }
  const enabled = await page.evaluate(
    (id: string) =>
      (window as unknown as ObsidianWindow).app?.plugins?.enabledPlugins?.has(id) ?? false,
    manifestId,
  );
  if (!enabled) {
    throw new Error(
      `setupObsidianSpec: plugin '${manifestId}' (built manifest id) is not enabled after setup.`,
    );
  }
}
