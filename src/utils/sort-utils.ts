import type { DataviewPage } from "../types";

/**
 * Orders two pages alphabetically by file name (locale-aware), returning a
 * negative number, zero, or a positive number as `Array.prototype.sort` expects.
 * The single page-name ordering rule. Pure, with no `obsidian` import, so headless
 * modules can import it directly from this module.
 */
export function compareByFileName(a: DataviewPage, b: DataviewPage): number {
  return a.file.name.localeCompare(b.file.name);
}
