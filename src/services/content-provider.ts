import { TFile } from "obsidian";
import type { Vault } from "obsidian";
import type { DataviewPage } from "../types";

/**
 * A note's body text, behind a Dependency-Inversion seam.
 *
 * A {@link DataviewPage} exposes only frontmatter, metadata, tags, and tasks —
 * never the note body — so content search must read the body from Obsidian's
 * Vault. This port lets {@link import("./search-service").SearchService} rank
 * over body text while staying headless: the sole `obsidian` import lives in the
 * implementation below, mirroring how {@link
 * import("./prepared-fuzzy-matcher").PreparedFuzzyMatcher} quarantines
 * `prepareFuzzySearch`. It is asynchronous because the read is.
 */
export interface IContentProvider {
  /** Resolves the page's body text; resolves to `""` when there is nothing to read. */
  textFor(page: DataviewPage): Promise<string>;
}

/** Leading YAML frontmatter block, excluded so "body" search never matches frontmatter. */
const FRONTMATTER_BLOCK = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

/**
 * The production {@link IContentProvider}: reads a note's body via
 * `Vault.cachedRead` (served from Obsidian's in-memory cache after first read),
 * stripping the leading frontmatter block. The file is resolved with
 * `getAbstractFileByPath` + an `instanceof TFile` guard — the pattern the search
 * panel already uses, and correct for the plugin's Obsidian 1.4.0+ target (unlike
 * the later `getFileByPath`). A missing or non-file path yields empty content;
 * per-note read failures are isolated by the caller.
 */
export class ObsidianContentProvider implements IContentProvider {
  constructor(private readonly vault: Vault) {}

  async textFor(page: DataviewPage): Promise<string> {
    const file = this.vault.getAbstractFileByPath(page.file.path);
    if (!(file instanceof TFile)) return "";
    const raw = await this.vault.cachedRead(file);
    return raw.replace(FRONTMATTER_BLOCK, "");
  }
}
