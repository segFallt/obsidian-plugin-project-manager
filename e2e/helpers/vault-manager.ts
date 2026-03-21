import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  WriteStream,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';
import https from 'https';

const PROJECT_ROOT = resolve(__dirname, '..', '..');
const FIXTURE_VAULT = resolve(__dirname, '..', 'fixtures', 'test-vault');

/** XDG_CONFIG_HOME directory used for test runs — shared with obsidian-app.ts. */
export const OBSIDIAN_CONFIG_DIR = '/tmp/test-obsidian-config';

/**
 * Copy the template test vault to a temp directory, inject the freshly built
 * main.js, and write the Obsidian config so Obsidian opens this vault on launch.
 *
 * Returns the path to the temp vault directory.
 */
export function createTempVault(): string {
  const tempDir = mkdtempSync(resolve(tmpdir(), 'obsidian-e2e-vault-'));
  cpSync(FIXTURE_VAULT, tempDir, { recursive: true });

  // Inject freshly built plugin artefacts.
  // manifest.json is copied from PROJECT_ROOT (the build source of truth) and
  // intentionally overwrites the fixture copy under .obsidian/plugins/project-manager/
  // so the loaded plugin version always matches the freshly built main.js.
  const pluginDir = resolve(tempDir, '.obsidian', 'plugins', 'project-manager');
  mkdirSync(pluginDir, { recursive: true });
  cpSync(resolve(PROJECT_ROOT, 'main.js'), resolve(pluginDir, 'main.js'));
  cpSync(resolve(PROJECT_ROOT, 'manifest.json'), resolve(pluginDir, 'manifest.json'));

  // Copy cached Dataview into vault
  const dataviewCache = resolve(
    __dirname,
    '..',
    'fixtures',
    '.dataview-cache',
  );
  if (existsSync(dataviewCache)) {
    const dataviewDest = resolve(
      tempDir,
      '.obsidian',
      'plugins',
      'dataview',
    );
    mkdirSync(dataviewDest, { recursive: true });
    cpSync(dataviewCache, dataviewDest, { recursive: true });
  }

  writeObsidianConfig(tempDir);
  return tempDir;
}

/**
 * Write /tmp/test-obsidian-config/obsidian.json so Obsidian opens the temp
 * vault on next launch.
 */
export function writeObsidianConfig(vaultPath: string): void {
  const configDir = OBSIDIAN_CONFIG_DIR;
  mkdirSync(resolve(configDir, 'obsidian'), { recursive: true });
  writeFileSync(
    resolve(configDir, 'obsidian', 'obsidian.json'),
    JSON.stringify({
      vaults: {
        'test-vault-id': {
          path: vaultPath,
          ts: Date.now(),
          open: true,
        },
      },
    }),
  );
}

/**
 * Delete a temp vault directory.
 */
export function removeTempVault(vaultPath: string): void {
  if (existsSync(vaultPath)) {
    rmSync(vaultPath, { recursive: true, force: true });
  }
}

/**
 * Download the Dataview plugin release ZIP from GitHub and extract it into
 * cacheDir if not already present.
 */
export async function downloadDataview(
  cacheDir: string,
  version: string,
): Promise<void> {
  const mainJsPath = resolve(cacheDir, 'main.js');
  if (existsSync(mainJsPath)) {
    console.log(`[vault-manager] Dataview v${version} already cached.`);
    return;
  }

  console.log(`[vault-manager] Downloading Dataview v${version}...`);

  const files = ['main.js', 'manifest.json', 'styles.css'];
  const base = `https://github.com/blacksmithgu/obsidian-dataview/releases/download/${version}`;

  await Promise.all(
    files.map(
      (file) =>
        new Promise<void>((resolve2, reject) => {
          const dest = resolve(cacheDir, file);
          const output = createWriteStream(dest);
          const url = `${base}/${file}`;
          downloadFile(url, output)
            .then(() => resolve2())
            .catch(reject);
        }),
    ),
  );
  console.log(`[vault-manager] Dataview v${version} downloaded.`);
}

function downloadFile(url: string, output: WriteStream): Promise<void> {
  return new Promise((resolve2, reject) => {
    const request = (targetUrl: string) => {
      https.get(targetUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          // Follow redirect
          request(res.headers.location!);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${targetUrl}`));
          return;
        }
        res.pipe(output);
        output.on('finish', () => output.close(() => resolve2()));
        output.on('error', reject);
      });
    };
    request(url);
  });
}
