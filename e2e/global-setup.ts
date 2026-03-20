import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { downloadDataview } from './helpers/vault-manager';

const PROJECT_ROOT = resolve(__dirname, '..');
const DATAVIEW_VERSION = '0.5.67';

export default async function globalSetup() {
  // 1. Verify Obsidian binary exists
  const obsidianBinary = process.env.OBSIDIAN_EXECUTABLE;
  if (!obsidianBinary) {
    throw new Error(
      'OBSIDIAN_EXECUTABLE env var is not set. Ensure the devcontainer was built correctly.',
    );
  }
  if (!existsSync(obsidianBinary)) {
    throw new Error(
      `Obsidian binary not found at: ${obsidianBinary}. Rebuild the devcontainer to re-extract the AppImage.`,
    );
  }
  console.log(`[global-setup] Obsidian binary: ${obsidianBinary}`);

  // 2. Build the plugin (produces main.js)
  console.log('[global-setup] Building plugin...');
  execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  const mainJs = resolve(PROJECT_ROOT, 'main.js');
  if (!existsSync(mainJs)) {
    throw new Error(`Build succeeded but main.js not found at: ${mainJs}`);
  }
  console.log('[global-setup] Plugin built successfully.');

  // 3. Download Dataview plugin if not cached
  const cacheDir = resolve(__dirname, 'fixtures', '.dataview-cache');
  mkdirSync(cacheDir, { recursive: true });
  await downloadDataview(cacheDir, DATAVIEW_VERSION);
  console.log('[global-setup] Dataview plugin ready.');
}
