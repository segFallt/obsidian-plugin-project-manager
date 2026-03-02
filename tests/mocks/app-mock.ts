/**
 * Factory for creating a mock Obsidian App with configurable vault state.
 * Used in service and command tests.
 */
import { App, TFile, TFolder } from "./obsidian-mock";

export interface MockVaultFile {
  path: string;
  content?: string;
  frontmatter?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Creates a fully configured mock App with an in-memory vault.
 */
export function createMockApp(files: MockVaultFile[] = []): App {
  const app = new App();

  // Build file + content maps
  const fileMap = new Map<string, TFile>();
  const contentMap = new Map<string, string>();
  const frontmatterMap = new Map<string, Record<string, unknown>>();

  for (const f of files) {
    const file = new TFile(f.path);
    fileMap.set(f.path, file);
    contentMap.set(f.path, f.content ?? "");
    if (f.frontmatter) frontmatterMap.set(f.path, { ...f.frontmatter });
  }

  // Vault adapter
  app.vault.adapter.exists = async (path: string) => fileMap.has(path);

  // Vault read
  app.vault.read = async (file: TFile) => contentMap.get(file.path) ?? "";

  // Vault modify
  app.vault.modify = async (file: TFile, content: string) => {
    contentMap.set(file.path, content);
  };

  // Vault create
  app.vault.create = async (path: string, content: string) => {
    const file = new TFile(path);
    fileMap.set(path, file);
    contentMap.set(path, content);
    return file;
  };

  // Vault createFolder
  app.vault.createFolder = async (path: string) => {
    const folder = new TFolder(path);
    fileMap.set(path, folder as unknown as TFile);
  };

  // getAbstractFileByPath
  app.vault.getAbstractFileByPath = (path: string) => fileMap.get(path) ?? null;

  // getMarkdownFiles
  app.vault.getMarkdownFiles = () =>
    [...fileMap.values()].filter((f) => f instanceof TFile && f.extension === "md");

  // MetadataCache
  app.metadataCache.getFileCache = (file: TFile) => {
    const fm = frontmatterMap.get(file.path);
    const originalFile = files.find((f) => f.path === file.path);
    if (!fm && !originalFile) return null;

    const tags = (originalFile?.tags ?? []).map((t) => ({ tag: t }));
    return { frontmatter: fm ?? {}, tags };
  };

  // FileManager processFrontMatter
  app.fileManager.processFrontMatter = async (file: TFile, mutator) => {
    const existing = frontmatterMap.get(file.path) ?? {};
    mutator(existing);
    frontmatterMap.set(file.path, existing);
  };

  return app;
}

export { TFile, TFolder };
