import type { DataviewLink } from "../types";

/**
 * Converts a file name (or path) to a wikilink string.
 *
 * @example toWikilink("My Project") → "[[My Project]]"
 */
export function toWikilink(name: string): string {
  return `[[${name}]]`;
}

/**
 * Parses a wikilink string into its component parts.
 * Returns null if the input is not a valid wikilink.
 *
 * @example parseWikilink("[[projects/Foo|Foo]]") → { path: "projects/Foo", display: "Foo" }
 */
export function parseWikilink(raw: string): { path: string; display: string | null } | null {
  const match = raw.trim().match(/^\[\[([^\]|]+)(\|([^\]]+))?\]\]$/);
  if (!match) return null;
  return {
    path: match[1].trim(),
    display: match[3]?.trim() ?? null,
  };
}

/**
 * Normalises any link format (DataviewLink object, wikilink string, or plain name)
 * to a plain file name without path or extension.
 *
 * Mirrors normalizeToComparableName() from the vault scripts.
 */
export function normalizeToName(item: unknown): string | null {
  if (!item) return null;

  // Dataview Link object
  if (typeof item === "object" && item !== null && "path" in item) {
    const link = item as DataviewLink;
    return link.path.split("/").pop()?.replace(/\.md$/, "") ?? null;
  }

  const str = String(item);
  // Wikilink format [[Name]] or [[path/Name|Display]]
  const parsed = parseWikilink(str);
  if (parsed) {
    return parsed.path.split("/").pop()?.replace(/\.md$/, "") ?? null;
  }

  // Plain name possibly ending in .md
  return str.replace(/\.md$/, "").split("/").pop() ?? str;
}

/**
 * Converts a DataviewLink or wikilink string to a display-friendly name.
 * Falls back to the raw string if normalisation fails.
 */
export function linkToDisplayName(item: unknown): string {
  return normalizeToName(item) ?? String(item);
}
