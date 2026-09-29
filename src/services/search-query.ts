import { EMPTY_QUERY } from "../constants";

/**
 * Normalizes a raw search query for matching: trims leading and trailing
 * whitespace and keeps inner whitespace, so "acme portal" matches only that
 * literal phrase. The single home for query normalization, shared by the search
 * service and the search panel. Pure, with no `obsidian` import.
 */
export function normalizeQuery(query: string): string {
  return query.trim();
}

/**
 * Whether a raw query selects browse mode: true when the normalized query is
 * {@link EMPTY_QUERY} (an empty or whitespace-only input), false otherwise.
 */
export function isBrowseQuery(query: string): boolean {
  return normalizeQuery(query) === EMPTY_QUERY;
}
