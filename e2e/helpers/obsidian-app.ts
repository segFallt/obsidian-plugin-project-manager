import { _electron as electron, ElectronApplication, Page } from 'playwright';

export interface ObsidianApp {
  app: ElectronApplication;
  window: Page;
}

/**
 * Launch Obsidian pointing at the given vault path.
 *
 * Flags explained:
 *   --no-sandbox / --disable-setuid-sandbox : required for Electron inside containers
 *   --disable-gpu                           : no real GPU in headless container
 *   --disable-dev-shm-usage                 : avoids /dev/shm 64 MB limit crashes in Docker
 */
export async function launchObsidian(vaultPath: string): Promise<ObsidianApp> {
  const executablePath = process.env.OBSIDIAN_EXECUTABLE;
  if (!executablePath) {
    throw new Error('OBSIDIAN_EXECUTABLE env var is not set.');
  }

  const app = await electron.launch({
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
    env: {
      ...process.env,
      XDG_CONFIG_HOME: '/tmp/test-obsidian-config',
    },
  });

  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  return { app, window };
}

/**
 * Close the Obsidian app cleanly.
 */
export async function closeObsidian(app: ElectronApplication): Promise<void> {
  await app.close();
}
