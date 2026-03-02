import { App, TFile } from "obsidian";

/**
 * Reads the frontmatter of a file and returns it as a plain object.
 * Returns an empty object if the file has no frontmatter or cannot be read.
 */
export function getFrontmatter(app: App, file: TFile): Record<string, unknown> {
  const cache = app.metadataCache.getFileCache(file);
  return { ...(cache?.frontmatter ?? {}) };
}

/**
 * Updates the frontmatter of a file using Obsidian's processFrontMatter API.
 * The mutator function receives the current frontmatter and can modify it in place.
 *
 * @throws If the vault cannot write the file.
 */
export async function updateFrontmatter(
  app: App,
  file: TFile,
  mutator: (fm: Record<string, unknown>) => void
): Promise<void> {
  await app.fileManager.processFrontMatter(file, mutator);
}

/**
 * Returns a single frontmatter property value, or undefined if not set.
 */
export function getFrontmatterValue(
  app: App,
  file: TFile,
  key: string
): unknown {
  const fm = getFrontmatter(app, file);
  return fm[key];
}
