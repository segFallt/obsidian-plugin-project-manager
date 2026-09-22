import { NOTES_MARKER, NL } from "../constants";

/** Matches a leading placeholder-dash line left by the entity template (e.g. `\n-`). */
const NOTES_PLACEHOLDER_DASH_RE = /^\n-(?= *\n|$)/;

/**
 * Inserts a body into a note's "# Notes" section, owning the `NOTES_MARKER`
 * branching for every service that writes notes content.
 *
 * - WITH_DASH (`# Notes\n-`): replaces the placeholder dash with the body.
 * - BASE (`# Notes\n`): inserts the body directly after the heading.
 * - No heading: appends a fresh `# Notes` section with the body.
 *
 * The body is never discarded — when no heading exists a new section is
 * appended rather than leaving the content unchanged.
 */
export function insertIntoNotesSection(content: string, body: string): string {
  if (content.includes(NOTES_MARKER.WITH_DASH)) {
    return content.replace(NOTES_MARKER.WITH_DASH, `${NOTES_MARKER.BASE}${body}`);
  }
  if (content.includes(NOTES_MARKER.BASE)) {
    return content.replace(NOTES_MARKER.BASE, `${NOTES_MARKER.BASE}${body}${NL}`);
  }
  return `${content}${NL}${NOTES_MARKER.BASE}${body}`;
}

/**
 * Extracts the trimmed content that follows the first "# Notes" heading.
 * Returns an empty string when the note has no Notes section.
 *
 * Strips a single leading placeholder-dash line (`-`) left by the entity
 * template before trimming, matching the entity-conversion read semantics.
 */
export function extractNotesSection(content: string): string {
  const notesIdx = content.indexOf(NOTES_MARKER.PREFIX);
  if (notesIdx < 0) return "";
  return content
    .slice(notesIdx + NOTES_MARKER.PREFIX.length)
    .replace(NOTES_PLACEHOLDER_DASH_RE, "")
    .trim();
}
