import { spawn, ChildProcess } from 'child_process';
import { chromium, Browser, Page } from '@playwright/test';
import { OBSIDIAN_CONFIG_DIR } from './vault-manager';

export interface ObsidianApp {
  browser: Browser;
  window: Page;
  childProcess: ChildProcess;
  /**
   * Re-acquires the live Page after Obsidian replaces its renderer process.
   *
   * Obsidian (and Dataview on first load) can navigate the renderer, making the
   * originally obtained Page reference stale. Call this method before interacting
   * with the vault if your test triggers vault initialisation or a renderer reload.
   */
  getVaultPage(): Promise<Page>;
}

/** Timeout for CDP WebSocket endpoint discovery on Obsidian startup. */
const CDP_TIMEOUT_MS = 15_000;

/**
 * Launch Obsidian via spawn() + CDP.
 *
 * Obsidian (Electron) ignores the --inspect flag that electron.launch() requires,
 * causing an indefinite hang. Instead we:
 *   1. spawn() Obsidian with --remote-debugging-port=0 (OS assigns a free port)
 *   2. Parse stdout/stderr for the "DevTools listening on ws://..." line
 *   3. Connect via chromium.connectOverCDP() to get a Browser handle
 *
 * The vault to open is communicated via the XDG config file written by
 * writeObsidianConfig() / createTempVault() before this function is called.
 *
 * Flags:
 *   --no-sandbox / --disable-setuid-sandbox : required for Electron inside containers
 *   --disable-gpu                           : no real GPU in headless container
 *   --disable-dev-shm-usage                 : avoids /dev/shm 64 MB limit crashes
 */
export async function launchObsidian(): Promise<ObsidianApp> {
  const executablePath = process.env.OBSIDIAN_EXECUTABLE;
  if (!executablePath) {
    throw new Error('OBSIDIAN_EXECUTABLE env var is not set.');
  }

  const child = spawn(
    executablePath,
    [
      '--remote-debugging-port=0',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
    {
      env: {
        ...process.env,
        XDG_CONFIG_HOME: OBSIDIAN_CONFIG_DIR,
      },
    },
  );

  // Discover the CDP WebSocket endpoint from process output.
  // Electron prints "DevTools listening on ws://127.0.0.1:<port>/..." to stderr
  // (some builds use stdout) before the renderer loads.
  const wsEndpoint = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `Timed out waiting for Obsidian DevTools endpoint after ${CDP_TIMEOUT_MS / 1_000}s. ` +
            'Check that OBSIDIAN_EXECUTABLE points to a valid Obsidian binary.',
        ),
      );
    }, CDP_TIMEOUT_MS);

    const onData = (data: Buffer) => {
      const text = data.toString();
      const match = text.match(/DevTools listening on (ws:\/\/.+)/);
      if (match) {
        clearTimeout(timer);
        child.stderr?.off('data', onData);
        child.stdout?.off('data', onData);
        resolve(match[1].trim());
      }
    };

    child.stderr?.on('data', onData);
    child.stdout?.on('data', onData);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  const browser = await chromium.connectOverCDP(wsEndpoint);

  // Retrieve the initial page — Obsidian opens one renderer window on launch.
  // Attach the waitForEvent listener before checking pages() to avoid a race
  // where the 'page' event fires between the empty-check and the listener attach.
  const context = browser.contexts()[0];
  const pagePromise = context.waitForEvent('page');
  const page = context.pages()[0] ?? (await pagePromise);
  await page.waitForLoadState('domcontentloaded');

  return {
    browser,
    window: page,
    childProcess: child,
    getVaultPage: async (): Promise<Page> => {
      const ctx = browser.contexts()[0];
      const pages = ctx.pages();
      return pages[pages.length - 1];
    },
  };
}

/**
 * Close the Obsidian app and its CDP-connected browser handle cleanly.
 * The child process is always killed, even if browser.close() throws.
 */
export async function closeObsidian(obsidianApp: ObsidianApp): Promise<void> {
  try {
    await obsidianApp.browser.close();
  } finally {
    obsidianApp.childProcess.kill();
  }
}
