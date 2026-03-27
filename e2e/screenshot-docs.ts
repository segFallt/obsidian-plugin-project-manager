/**
 * screenshot-docs.ts
 *
 * Standalone script that launches Obsidian with a rich fixture vault and
 * captures screenshots for the user-guide documentation.
 *
 * Usage:
 *   npx ts-node --project e2e/tsconfig.json e2e/screenshot-docs.ts
 *
 * Output: docs/plugin/user-guide/assets/*.png
 *
 * Prerequisites:
 *   - OBSIDIAN_EXECUTABLE env var pointing to the Obsidian binary
 *   - Plugin must be built (main.js must exist at project root)
 *   - Dataview plugin must be cached in e2e/fixtures/.dataview-cache/
 */

import { chromium, Browser, Page } from '@playwright/test';
import { execSync } from 'child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import { spawn } from 'child_process';

// ─── Paths ────────────────────────────────────────────────────────────────────

const PROJECT_ROOT = resolve(__dirname, '..');
const FIXTURE_VAULT = resolve(__dirname, 'fixtures', 'screenshot-vault');
const DATAVIEW_CACHE = resolve(__dirname, 'fixtures', '.dataview-cache');
const ASSETS_DIR = resolve(PROJECT_ROOT, 'docs', 'plugin', 'user-guide', 'assets');
const OBSIDIAN_CONFIG_DIR = '/tmp/screenshot-obsidian-config';
const CDP_TIMEOUT_MS = 20_000;

// ─── Vault setup ─────────────────────────────────────────────────────────────

function createVault(): string {
  const tempDir = mkdtempSync(resolve(tmpdir(), 'obsidian-screenshot-vault-'));
  cpSync(FIXTURE_VAULT, tempDir, { recursive: true });

  // Inject freshly built plugin
  const pluginDir = resolve(tempDir, '.obsidian', 'plugins', 'project-manager');
  mkdirSync(pluginDir, { recursive: true });
  cpSync(resolve(PROJECT_ROOT, 'main.js'), resolve(pluginDir, 'main.js'));
  cpSync(resolve(PROJECT_ROOT, 'manifest.json'), resolve(pluginDir, 'manifest.json'));

  // Inject Dataview
  if (existsSync(DATAVIEW_CACHE)) {
    const dataviewDest = resolve(tempDir, '.obsidian', 'plugins', 'dataview');
    mkdirSync(dataviewDest, { recursive: true });
    cpSync(DATAVIEW_CACHE, dataviewDest, { recursive: true });
  }

  // Write Obsidian config pointing to this vault
  mkdirSync(resolve(OBSIDIAN_CONFIG_DIR, 'obsidian'), { recursive: true });
  writeFileSync(
    resolve(OBSIDIAN_CONFIG_DIR, 'obsidian', 'obsidian.json'),
    JSON.stringify({
      vaults: {
        'screenshot-vault-id': {
          path: tempDir,
          ts: Date.now(),
          open: true,
        },
      },
    }),
  );

  return tempDir;
}

// ─── Obsidian launch ─────────────────────────────────────────────────────────

async function launchObsidian(): Promise<{ browser: Browser; page: Page; kill: () => void }> {
  const executablePath = process.env.OBSIDIAN_EXECUTABLE;
  if (!executablePath) throw new Error('OBSIDIAN_EXECUTABLE is not set');

  const child = spawn(
    executablePath,
    [
      '--remote-debugging-port=0',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
    { env: { ...process.env, XDG_CONFIG_HOME: OBSIDIAN_CONFIG_DIR } },
  );

  const wsEndpoint = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for Obsidian DevTools after ${CDP_TIMEOUT_MS / 1000}s`)),
      CDP_TIMEOUT_MS,
    );
    const onData = (data: Buffer) => {
      const match = data.toString().match(/DevTools listening on (ws:\/\/.+)/);
      if (match) {
        clearTimeout(timer);
        child.stderr?.off('data', onData);
        child.stdout?.off('data', onData);
        resolve(match[1].trim());
      }
    };
    child.stderr?.on('data', onData);
    child.stdout?.on('data', onData);
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
  });

  const browser = await chromium.connectOverCDP(wsEndpoint);
  await sleep(1000);

  // Acquire page with retry
  let page: Page | null = null;
  for (let attempt = 1; attempt <= 5 && !page; attempt++) {
    const contexts = browser.contexts();
    if (contexts.length > 0) {
      const pages = contexts[0].pages();
      if (pages.length > 0 && !pages[0].isClosed()) {
        page = pages[0];
      }
    }
    if (!page) await sleep(1000);
  }
  if (!page) throw new Error('Failed to acquire Obsidian page');

  await page.waitForLoadState('domcontentloaded');

  return {
    browser,
    page,
    kill: () => { try { browser.close(); } finally { child.kill(); } },
  };
}

// ─── Plugin initialisation ────────────────────────────────────────────────────

async function initPlugin(page: Page): Promise<void> {
  // Dismiss any modal overlays
  for (const selector of [
    'button:has-text("Accept")',
    'button:has-text("I Agree")',
    '.modal-close-button',
    'button:has-text("Turn on community plugins")',
  ]) {
    const el = await page.$(selector).catch(() => null);
    if (el) { await el.click(); await sleep(300); }
  }

  // Enable and load the plugin
  await page.evaluate(async () => {
    const app = (window as any).app;
    if (app?.plugins) {
      app.plugins.setEnable('project-manager', true);
      await app.plugins.loadPlugin('project-manager');
    }
  });

  // Wait for plugin commands to be registered
  await page.waitForFunction(
    () => !!(window as any).app?.commands?.commands?.['project-manager:create-client'],
    { timeout: 15_000 },
  );

  // Wait for workspace to be ready
  await page.waitForSelector('.workspace', { timeout: 30_000 });
  await sleep(2000); // Let Dataview index
}

// ─── Navigation helpers ───────────────────────────────────────────────────────

async function openNote(page: Page, notePath: string): Promise<void> {
  await page.evaluate((path: string) => {
    (window as any).app.workspace.openLinkText(path, '/', false);
  }, notePath);
  await sleep(1500);
  // Re-acquire page in case renderer navigated
  const ctx = (await (page as any).context()) ?? page.context();
}

async function switchToReadingView(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).app.commands.executeCommandById('markdown:toggle-preview');
  });
  await sleep(800);
}

async function ensureReadingView(page: Page): Promise<void> {
  // Check if already in reading view; if not, switch
  const isPreview = await page.evaluate(() => {
    const leaf = (window as any).app.workspace.getMostRecentLeaf();
    return leaf?.getViewState()?.state?.mode === 'preview';
  });
  if (!isPreview) await switchToReadingView(page);
  await sleep(800);
}

async function openSettings(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).app.commands.executeCommandById('app:open-settings');
  });
  await sleep(800);
  await page.waitForSelector('.modal-container', { timeout: 5000 });
}

async function closeModal(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await sleep(400);
}

async function screenshot(page: Page, filename: string): Promise<void> {
  const livePages = page.context().pages();
  const livePage = livePages[livePages.length - 1];
  await livePage.screenshot({ path: resolve(ASSETS_DIR, filename) });
  console.log(`  ✓ ${filename}`);
}

async function screenshotElement(page: Page, selector: string, filename: string): Promise<void> {
  const livePages = page.context().pages();
  const livePage = livePages[livePages.length - 1];
  const el = await livePage.$(selector);
  if (el) {
    await el.screenshot({ path: resolve(ASSETS_DIR, filename) });
  } else {
    // Fall back to full page
    await livePage.screenshot({ path: resolve(ASSETS_DIR, filename) });
  }
  console.log(`  ✓ ${filename}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Ensure output directory exists
  mkdirSync(ASSETS_DIR, { recursive: true });

  // Build plugin
  console.log('\n[screenshot-docs] Building plugin...');
  execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' });

  // Create temp vault
  console.log('[screenshot-docs] Creating temp vault...');
  const vaultPath = createVault();
  console.log(`  Vault: ${vaultPath}`);

  console.log('[screenshot-docs] Launching Obsidian...');
  const { browser, page, kill } = await launchObsidian();

  try {
    // Set a comfortable viewport
    await page.setViewportSize({ width: 1280, height: 900 });

    console.log('[screenshot-docs] Initialising plugin...');
    await initPlugin(page);

    // ── Settings screenshots ─────────────────────────────────────────────────
    console.log('\n[screenshot-docs] Settings screenshots...');
    await openSettings(page);

    // Navigate to Project Manager settings tab
    const pmTab = await page.$('.vertical-tab-nav-item:has-text("Project Manager")');
    if (pmTab) { await pmTab.click(); await sleep(600); }

    await screenshotElement(page, '.vertical-tab-content-container', 'settings-overview.png');

    // Scroll through the settings sections
    const settingsSections = [
      { heading: 'Folder Paths', filename: 'settings-folder-paths.png' },
      { heading: 'Default Values', filename: 'settings-default-values.png' },
      { heading: 'UI Preferences', filename: 'settings-ui-preferences.png' },
      { heading: 'Debug Logging', filename: 'settings-debug-logging.png' },
      { heading: 'Vault Management', filename: 'settings-vault-management.png' },
      { heading: 'Developer Tools', filename: 'settings-developer-tools.png' },
    ];

    for (const { heading, filename } of settingsSections) {
      await page.evaluate((h: string) => {
        const headings = Array.from(document.querySelectorAll('h3'));
        const target = headings.find((el) => el.textContent?.trim() === h);
        if (target) target.scrollIntoView({ block: 'start' });
      }, heading);
      await sleep(400);
      await screenshotElement(page, '.vertical-tab-content-container', filename);
    }

    await closeModal(page);

    // ── pm-properties screenshots ────────────────────────────────────────────
    console.log('\n[screenshot-docs] pm-properties screenshots...');
    await openNote(page, 'docs-screenshots/demo-pm-properties-project');
    await ensureReadingView(page);
    await sleep(1000);
    await screenshotElement(page, '.markdown-preview-view', 'pm-properties-project.png');

    await openNote(page, 'docs-screenshots/demo-pm-properties-client');
    await ensureReadingView(page);
    await sleep(1000);
    await screenshotElement(page, '.markdown-preview-view', 'pm-properties-client.png');

    // ── pm-table screenshots ─────────────────────────────────────────────────
    console.log('\n[screenshot-docs] pm-table screenshots...');
    await openNote(page, 'docs-screenshots/demo-pm-table-client');
    await ensureReadingView(page);
    await sleep(1500);
    await screenshotElement(page, '.markdown-preview-view', 'pm-table-client.png');

    // Engagement → projects table
    await openNote(page, 'engagements/Acme Digital Transformation');
    await ensureReadingView(page);
    await sleep(1500);
    await screenshotElement(page, '.markdown-preview-view', 'pm-table-engagement-projects.png');

    // Project → project notes table
    await openNote(page, 'projects/Website Redesign');
    await ensureReadingView(page);
    await sleep(1500);
    await screenshotElement(page, '.markdown-preview-view', 'pm-table-project-notes.png');

    // ── pm-actions screenshots ───────────────────────────────────────────────
    console.log('\n[screenshot-docs] pm-actions screenshots...');
    await openNote(page, 'docs-screenshots/demo-pm-actions');
    await ensureReadingView(page);
    await sleep(1000);
    await screenshotElement(page, '.markdown-preview-view', 'pm-actions.png');

    // ── pm-entity-view screenshots ───────────────────────────────────────────
    console.log('\n[screenshot-docs] pm-entity-view screenshots...');
    await openNote(page, 'docs-screenshots/demo-pm-entity-view');
    await ensureReadingView(page);
    await sleep(1500);
    await screenshotElement(page, '.markdown-preview-view', 'pm-entity-view.png');

    // ── pm-tasks screenshots ─────────────────────────────────────────────────
    console.log('\n[screenshot-docs] pm-tasks screenshots...');
    await openNote(page, 'docs-screenshots/demo-pm-tasks-dashboard');
    await ensureReadingView(page);
    await sleep(2000); // Tasks need time to load
    await screenshotElement(page, '.markdown-preview-view', 'pm-tasks-dashboard.png');

    // Open the filter drawer — wait for the button to appear then click it
    {
      const livePage = page.context().pages()[page.context().pages().length - 1];
      try {
        // Wait up to 5s for the filter button to appear in the DOM
        await livePage.waitForFunction(
          () => !!document.querySelector('.pm-tasks-toolbar__filters-btn'),
          { timeout: 5000 },
        );
        // Click the filter button to open drawer
        await livePage.evaluate(() => {
          const btn = document.querySelector('.pm-tasks-toolbar__filters-btn') as HTMLElement;
          btn.click();
        });
        await sleep(1200);
        // Take full-viewport screenshot to capture the drawer (it may extend below the element)
        await livePage.screenshot({ path: resolve(ASSETS_DIR, 'pm-tasks-filter-drawer.png') });
        console.log(`  ✓ pm-tasks-filter-drawer.png`);
        // Close drawer
        await livePage.evaluate(() => {
          const btn = document.querySelector('.pm-tasks-toolbar__filters-btn') as HTMLElement;
          btn.click();
        });
        await sleep(400);
      } catch {
        console.log('  ⚠ Filter button not found within 5s — taking plain screenshot');
        await screenshotElement(page, '.markdown-preview-view', 'pm-tasks-filter-drawer.png');
      }
    }

    await openNote(page, 'docs-screenshots/demo-pm-tasks-by-project');
    await ensureReadingView(page);
    await sleep(2000);
    await screenshotElement(page, '.markdown-preview-view', 'pm-tasks-by-project.png');

    // ── pm-recurring-events screenshot ───────────────────────────────────────
    console.log('\n[screenshot-docs] pm-recurring-events screenshot...');
    // Use the actual recurring meeting note (name-matched to the fixture)
    await openNote(page, 'meetings/recurring/Weekly Standup');
    await ensureReadingView(page);
    await sleep(2000);
    await screenshotElement(page, '.markdown-preview-view', 'pm-recurring-events.png');

    // ── pm-raid-dashboard screenshot ──────────────────────────────────────────
    console.log('\n[screenshot-docs] pm-raid-dashboard screenshot...');
    await openNote(page, 'docs-screenshots/demo-pm-raid-dashboard');
    await ensureReadingView(page);
    await sleep(2000);
    await screenshotElement(page, '.markdown-preview-view', 'pm-raid-dashboard.png');

    // ── pm-raid-references screenshot ────────────────────────────────────────
    console.log('\n[screenshot-docs] pm-raid-references screenshot...');
    await openNote(page, 'raid/Performance Degradation Risk');
    await ensureReadingView(page);
    await sleep(2000);
    await screenshotElement(page, '.markdown-preview-view', 'pm-raid-references.png');

    // ── pm-references screenshot ──────────────────────────────────────────────
    console.log('\n[screenshot-docs] pm-references screenshot...');
    await openNote(page, 'docs-screenshots/demo-pm-references');
    await ensureReadingView(page);
    await sleep(2000);
    await screenshotElement(page, '.markdown-preview-view', 'pm-references.png');

    // ── Command modal screenshots ─────────────────────────────────────────────
    console.log('\n[screenshot-docs] Command modal screenshots...');
    await openNote(page, 'docs-screenshots/demo-pm-actions');
    await sleep(500);

    const commandModals: Array<{ commandId: string; filename: string; waitFor?: string }> = [
      { commandId: 'project-manager:create-client', filename: 'modal-create-client.png', waitFor: '.modal-container' },
      { commandId: 'project-manager:create-engagement', filename: 'modal-create-engagement.png', waitFor: '.modal-container' },
      { commandId: 'project-manager:create-project', filename: 'modal-create-project.png', waitFor: '.modal-container' },
      { commandId: 'project-manager:create-person', filename: 'modal-create-person.png', waitFor: '.modal-container' },
      { commandId: 'project-manager:create-raid-item', filename: 'modal-create-raid-item.png', waitFor: '.modal-container' },
      { commandId: 'project-manager:create-reference', filename: 'modal-create-reference.png', waitFor: '.modal-container' },
    ];

    for (const { commandId, filename, waitFor } of commandModals) {
      await page.evaluate((id: string) => {
        (window as any).app.commands.executeCommandById(id);
      }, commandId);
      await sleep(500);
      if (waitFor) {
        try {
          await page.waitForSelector(waitFor, { timeout: 3000 });
        } catch {
          // Modal may not have appeared — skip
          console.log(`  ⚠ Modal not found for ${commandId}, skipping`);
          continue;
        }
      }
      await screenshotElement(page, '.modal-container', filename);
      await closeModal(page);
      await sleep(300);
    }

    // ── Settings tab full overview (scrolled to top) ──────────────────────────
    console.log('\n[screenshot-docs] Settings full tab screenshot...');
    await openSettings(page);
    const pmTabFull = await page.$('.vertical-tab-nav-item:has-text("Project Manager")');
    if (pmTabFull) { await pmTabFull.click(); await sleep(600); }
    await screenshot(page, 'settings-tab-full.png');
    await closeModal(page);

    console.log('\n[screenshot-docs] All screenshots captured successfully.');
    console.log(`Output: ${ASSETS_DIR}`);

  } finally {
    kill();
    try { rmSync(vaultPath, { recursive: true, force: true }); } catch { /* ignore */ }
    try { rmSync(OBSIDIAN_CONFIG_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

main().catch((err) => {
  console.error('[screenshot-docs] Fatal error:', err);
  process.exit(1);
});
