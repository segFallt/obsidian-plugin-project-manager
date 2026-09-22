import type { App, TFile } from "obsidian";

/**
 * Minimal frontmatter read/write port. Isolating the two Obsidian calls the
 * frontmatter view-store needs behind one interface keeps the store's logic
 * (key nesting, echo recognition, diff-before-write) unit-testable without a
 * live vault.
 */
export interface FrontmatterIO {
  /** The file's current frontmatter, or `null` when it has none / is unreadable. */
  read(file: TFile): Record<string, unknown> | null;
  /** Atomically mutate the file's frontmatter. */
  write(file: TFile, mutate: (fm: Record<string, unknown>) => void): Promise<void>;
}

/**
 * Obsidian-backed {@link FrontmatterIO}: reads through the metadata cache and
 * writes through `fileManager.processFrontMatter` (the only two frontmatter
 * primitives the store depends on).
 */
export class ObsidianFrontmatterIO implements FrontmatterIO {
  constructor(private readonly app: App) {}

  read(file: TFile): Record<string, unknown> | null {
    return this.app.metadataCache.getFileCache(file)?.frontmatter ?? null;
  }

  write(file: TFile, mutate: (fm: Record<string, unknown>) => void): Promise<void> {
    return this.app.fileManager.processFrontMatter(file, mutate);
  }
}
