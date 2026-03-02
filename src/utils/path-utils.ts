import { App, TFolder } from "obsidian";

/**
 * Converts a display name to a snake_case directory-safe string.
 * Strips non-alphanumeric characters, lowercases, replaces spaces with underscores.
 *
 * @example toSnakeCase("My Project #1!") → "my_project_1"
 */
export function toSnakeCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Generates the notes directory path for a project.
 * e.g. "My Project" → "projects/notes/my_project"
 */
export function generateProjectNotesPath(projectName: string, baseFolder = "projects/notes"): string {
  return `${baseFolder}/${toSnakeCase(projectName)}`;
}

/**
 * Returns a conflict-free file path by appending an incrementing counter
 * when the base path already exists.
 *
 * @example resolveConflictPath(app, "projects/Foo.md") → "projects/Foo 2.md"
 */
export async function resolveConflictPath(app: App, basePath: string): Promise<string> {
  let path = basePath;
  let counter = 1;
  while (await app.vault.adapter.exists(path)) {
    counter++;
    // Insert counter before the extension
    const dotIndex = basePath.lastIndexOf(".");
    if (dotIndex === -1) {
      path = `${basePath} ${counter}`;
    } else {
      path = `${basePath.substring(0, dotIndex)} ${counter}${basePath.substring(dotIndex)}`;
    }
  }
  return path;
}

/**
 * Ensures a folder (and all ancestors) exists in the vault.
 * No-ops if the folder already exists.
 */
export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
  if (!folderPath || folderPath === "/") return;

  const existing = app.vault.getAbstractFileByPath(folderPath);
  if (existing instanceof TFolder) return;

  // Create parent first (recursive)
  const parentPath = folderPath.split("/").slice(0, -1).join("/");
  if (parentPath) {
    await ensureFolderExists(app, parentPath);
  }

  try {
    await app.vault.createFolder(folderPath);
  } catch {
    // Folder may have been created by a concurrent call; ignore if so
    const check = app.vault.getAbstractFileByPath(folderPath);
    if (!(check instanceof TFolder)) {
      throw new Error(`Failed to create folder: ${folderPath}`);
    }
  }
}

/**
 * Extracts the file name (without extension) from a vault path.
 *
 * @example fileNameFromPath("projects/My Project.md") → "My Project"
 */
export function fileNameFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  const dotIndex = base.lastIndexOf(".");
  return dotIndex === -1 ? base : base.substring(0, dotIndex);
}
