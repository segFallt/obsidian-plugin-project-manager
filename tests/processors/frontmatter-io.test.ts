import { describe, it, expect, vi } from "vitest";
import type { App, TFile } from "obsidian";
import { ObsidianFrontmatterIO } from "@/processors/frontmatter-io";

const file = { path: "note.md" } as unknown as TFile;

describe("ObsidianFrontmatterIO", () => {
  it("reads frontmatter from the metadata cache", () => {
    const getFileCache = vi.fn(() => ({ frontmatter: { foo: "bar" } }));
    const io = new ObsidianFrontmatterIO({ metadataCache: { getFileCache } } as unknown as App);
    expect(io.read(file)).toEqual({ foo: "bar" });
    expect(getFileCache).toHaveBeenCalledWith(file);
  });

  it("returns null when the file has no cache or no frontmatter", () => {
    const io = new ObsidianFrontmatterIO({
      metadataCache: { getFileCache: () => null },
    } as unknown as App);
    expect(io.read(file)).toBeNull();
  });

  it("delegates writes to fileManager.processFrontMatter", async () => {
    const processFrontMatter = vi.fn(
      async (_f: TFile, mutate: (fm: Record<string, unknown>) => void) => {
        const fm: Record<string, unknown> = {};
        mutate(fm);
        expect(fm).toEqual({ k: 1 });
      }
    );
    const io = new ObsidianFrontmatterIO({ fileManager: { processFrontMatter } } as unknown as App);
    await io.write(file, (fm) => {
      fm.k = 1;
    });
    expect(processFrontMatter).toHaveBeenCalledOnce();
  });
});
