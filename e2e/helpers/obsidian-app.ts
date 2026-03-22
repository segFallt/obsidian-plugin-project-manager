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

  // Give Obsidian's renderer time to complete its initial process replacement
  // before we try to acquire a context. Without this, the context captured
  // immediately after connectOverCDP may be destroyed milliseconds later.
  await new Promise<void>(r => setTimeout(r, 800));

  // Fail fast if Obsidian crashes while we are waiting for a page.
  let obsidianExited = false;
  let rejectOnExit: ((err: Error) => void) | null = null;
  child.on('exit', (code) => {
    obsidianExited = true;
    rejectOnExit?.(new Error(`Obsidian process exited unexpectedly (code ${code}) during page acquisition`));
  });

  // Resilient retry loop: the CDP context may be briefly destroyed while
  // Obsidian replaces its renderer process during vault initialisation.
  let page: Page | null = null;
  for (let attempt = 1; attempt <= 3 && !page; attempt++) {
    if (obsidianExited) {
      throw new Error('Obsidian process exited before a page could be acquired');
    }
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      if (attempt < 3) {
        await new Promise<void>(r => setTimeout(r, 1000));
        continue;
      }
      throw new Error('No browser contexts available after 3 attempts');
    }
    const ctx = contexts[0];
    try {
      const pages = ctx.pages();
      if (pages.length > 0 && !pages[0].isClosed()) {
        page = pages[0];
      } else {
        page = await new Promise<Page>((resolve, reject) => {
          rejectOnExit = reject;
          ctx.waitForEvent('page', { timeout: 2000 }).then(resolve).catch(reject);
        });
        rejectOnExit = null;
      }
    } catch (err) {
      rejectOnExit = null;
      if (attempt < 3) {
        await new Promise<void>(r => setTimeout(r, 1000));
      } else {
        throw new Error(`Failed to acquire Obsidian page after 3 attempts: ${(err as Error).message}`);
      }
    }
  }
  if (!page) {
    throw new Error('Failed to acquire Obsidian page: exhausted all attempts');
  }
  await page.waitForLoadState('domcontentloaded');

  return {
    browser,
    window: page,
    childProcess: child,
    getVaultPage: async (): Promise<Page> => {
      const ctx = browser.contexts()[0];
      const pages = ctx.pages();
      const candidate = pages[pages.length - 1];
      if (!candidate || candidate.isClosed()) {
        // Wait briefly and retry once — renderer may be mid-navigation
        await new Promise<void>(r => setTimeout(r, 500));
        const refreshedPages = browser.contexts()[0]?.pages() ?? [];
        const refreshed = refreshedPages[refreshedPages.length - 1];
        if (!refreshed || refreshed.isClosed()) {
          throw new Error('getVaultPage: no open page available');
        }
        return refreshed;
      }
      return candidate;
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
