/**
 * Shared TypeScript types for E2E helpers and specs.
 *
 * These types describe the shape of Obsidian's internal runtime API as
 * accessed via page.evaluate(). They are TypeScript-only (erased at compile
 * time) and have no effect on what Playwright serialises into the browser.
 */

export interface ObsidianPlugins {
  enabledPlugins?: Set<string>;
  /** Synchronous — sets the enabled flag in the plugin manager's data object. */
  setEnable: (id: string, enabled: boolean) => void;
  /** Async — runs the plugin's onload() and registers its commands. */
  loadPlugin: (id: string) => Promise<void>;
}

export interface ObsidianCommands {
  commands?: Record<string, unknown>;
  executeCommandById: (id: string) => boolean;
}

export interface ObsidianFile {
  path: string;
  basename: string;
}

export interface ObsidianWorkspace {
  getActiveFile: () => ObsidianFile | null;
}

export interface ObsidianMetadataCache {
  getFileCache: (file: ObsidianFile) => { frontmatter?: Record<string, unknown> } | null;
}

export interface ObsidianVault {
  getAllLoadedFiles: () => ObsidianFile[];
}

/**
 * Augments `Window` with the Obsidian `app` object available in the renderer.
 * Cast `window` to this type inside page.evaluate() to access Obsidian internals.
 */
export interface ObsidianWindow extends Window {
  app?: {
    plugins?: ObsidianPlugins;
    commands?: ObsidianCommands;
    workspace?: ObsidianWorkspace;
    metadataCache?: ObsidianMetadataCache;
    vault?: ObsidianVault;
  };
}
