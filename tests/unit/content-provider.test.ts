import { describe, it, expect, vi } from "vitest";
import { TFile, TFolder } from "obsidian";
import type { Vault } from "obsidian";
import { ObsidianContentProvider } from "@/services/content-provider";
import { createMockPage } from "../mocks/dataview-mock";

/** A vault stub: `resolve` decides what a path resolves to; `cachedRead` returns the file's content. */
function vaultStub(
  resolve: (path: string) => TFile | TFolder | null,
  content = ""
): { vault: Vault; cachedRead: ReturnType<typeof vi.fn> } {
  const cachedRead = vi.fn().mockResolvedValue(content);
  const vault = { getAbstractFileByPath: resolve, cachedRead } as unknown as Vault;
  return { vault, cachedRead };
}

const pageAt = (path: string): ReturnType<typeof createMockPage> => createMockPage({ path });

describe("ObsidianContentProvider", () => {
  it("reads a note's body and strips the leading frontmatter block", async () => {
    const raw = "---\ntitle: Northwind\ntags: [client]\n---\nThe body mentions pineapple.\n";
    const { vault } = vaultStub((path) => new TFile(path), raw);

    const text = await new ObsidianContentProvider(vault).textFor(pageAt("clients/Northwind.md"));

    expect(text).toContain("pineapple");
    expect(text).not.toContain("title:");
    expect(text).not.toContain("---");
  });

  it("returns the whole content unchanged when there is no frontmatter", async () => {
    const raw = "Just body text, no frontmatter.";
    const { vault } = vaultStub((path) => new TFile(path), raw);

    expect(await new ObsidianContentProvider(vault).textFor(pageAt("clients/Plain.md"))).toBe(raw);
  });

  it("returns empty content and does not read when the path resolves to no file", async () => {
    const { vault, cachedRead } = vaultStub(() => null, "unused");

    expect(await new ObsidianContentProvider(vault).textFor(pageAt("clients/Missing.md"))).toBe("");
    expect(cachedRead).not.toHaveBeenCalled();
  });

  it("returns empty content when the path resolves to a folder, not a file", async () => {
    const { vault, cachedRead } = vaultStub((path) => new TFolder(path), "unused");

    expect(await new ObsidianContentProvider(vault).textFor(pageAt("clients"))).toBe("");
    expect(cachedRead).not.toHaveBeenCalled();
  });

  it("resolves the file by the page's path via getAbstractFileByPath", async () => {
    const resolve = vi.fn((path: string) => new TFile(path));
    const { vault } = vaultStub(resolve, "body");

    await new ObsidianContentProvider(vault).textFor(pageAt("projects/Acme Portal.md"));

    expect(resolve).toHaveBeenCalledWith("projects/Acme Portal.md");
  });
});
