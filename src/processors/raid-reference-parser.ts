import type { RaidType, RaidDirection, RaidReferenceEntry } from "../types";
import { DEFAULT_DIRECTION_LABEL, ATX_HEADING_RE, RAID_SCOPE } from "./raid-constants";

/** Leading YAML front-matter fence delimiter (opens and closes the top block). */
const FRONT_MATTER_DELIMITER = "---";

/** Matches an opening/closing fenced-code marker (``` or ~~~, up to 3 lead spaces). */
const CODE_FENCE_RE = /^\s{0,3}(`{3,}|~{3,})/;

/**
 * Pure, DOM-free parser for RAID reference annotations (issue #90).
 *
 * Extracts every `{raid:<direction>}[[<raidItemName>]]` annotation from raw
 * Markdown file content and classifies each match as either:
 *   - a `line` scope entry (the single annotated line, annotation stripped), or
 *   - a `section` scope entry (the annotated ATX heading plus the full body
 *     beneath it, up to the next heading of equal-or-higher level or EOF).
 *
 * This module takes plain strings only and needs NO Obsidian services, so it is
 * fully unit-testable without jsdom. The matching/stripping semantics mirror the
 * item-specific `annotationPattern` the processor previously built inline.
 *
 * Known limitation — setext headings (`Title` underlined by `===`/`---`) are not
 * recognised as headings: the ATX regex does not match them, and a bare `---`
 * also collides with YAML front-matter delimiters and thematic breaks, so it
 * cannot be disambiguated reliably. A RAID annotation placed on a setext title
 * line therefore falls back to `line` scope (unchanged legacy behaviour) rather
 * than opening a section. The parser never crashes on such input.
 */
export function parseRaidReferences(
  content: string,
  raidItemName: string,
  resolvedRaidType: RaidType,
  labels: Record<RaidDirection, Record<RaidType, string>>
): RaidReferenceEntry[] {
  const annotationPattern = new RegExp(
    `\\{raid:(positive|negative|neutral)\\}\\[\\[${escapeRegex(raidItemName)}\\]\\]`,
    "g"
  );

  const lines = content.split("\n");
  const headingLevels = classifyHeadingLevels(lines);
  const entries: RaidReferenceEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    annotationPattern.lastIndex = 0;
    const match = annotationPattern.exec(line);
    if (!match) continue;

    const direction = match[1] as RaidDirection;
    const label = labels[direction]?.[resolvedRaidType] ?? DEFAULT_DIRECTION_LABEL;
    const level = headingLevels[i];

    if (level > 0) {
      // Section scope — capture body lines until the next heading of equal or
      // higher level (level <= tagged heading's level); deeper subsections are
      // included; terminate at EOF.
      const headingText = stripAnnotation(line, annotationPattern).trim();
      const bodyLines: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const bodyLevel = headingLevels[j];
        if (bodyLevel > 0 && bodyLevel <= level) break;
        bodyLines.push(lines[j]);
      }
      // Strip ONLY the current item's own annotation from the body (avoids a
      // self-referential badge); other raid items' annotations are left intact
      // so they render as live cross-reference badges.
      const bodyMarkdown = stripAnnotation(bodyLines.join("\n"), annotationPattern).trim();
      entries.push({ scope: RAID_SCOPE.SECTION, direction, label, headingText, bodyMarkdown });
    } else {
      // Line scope — exact legacy behaviour: strip the annotation and trim.
      const lineText = stripAnnotation(line, annotationPattern).trim();
      entries.push({ scope: RAID_SCOPE.LINE, direction, label, lineText });
    }
  }

  return entries;
}

/**
 * Context-aware check for whether the line at `lineNumber` (0-based) is a real
 * section-opening ATX heading — i.e. it would open a `section` scope entry.
 *
 * Mirrors the parser's own classification (fenced code blocks and YAML
 * front-matter are excluded), so callers such as the tag command can decide
 * line- vs section-scope feedback without diverging from render behaviour.
 */
export function isSectionHeadingLine(content: string, lineNumber: number): boolean {
  return classifyHeadingLevels(content.split("\n"))[lineNumber] > 0;
}

/**
 * Classifies every line as an ATX heading (returning its level 1-6) or non-heading
 * (0), correctly ignoring `#`-prefixed lines that live inside fenced code blocks
 * or YAML front-matter so they neither open nor close a section.
 */
function classifyHeadingLevels(lines: string[]): number[] {
  const levels: number[] = lines.map(() => 0);
  let inFence = false;
  let fenceChar = "";
  let inFrontMatter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // YAML front-matter — only the leading `---`…`---` block at the very top.
    if (i === 0 && trimmed === FRONT_MATTER_DELIMITER) {
      inFrontMatter = true;
      continue;
    }
    if (inFrontMatter) {
      if (trimmed === FRONT_MATTER_DELIMITER) inFrontMatter = false;
      continue;
    }

    // Fenced code blocks — ``` or ~~~ (a fence only closes on its own marker char).
    const fenceMatch = CODE_FENCE_RE.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = marker;
      } else if (marker === fenceChar) {
        inFence = false;
        fenceChar = "";
      }
      continue;
    }
    if (inFence) continue;

    const headingMatch = ATX_HEADING_RE.exec(line);
    if (headingMatch) levels[i] = headingMatch[1].length;
  }

  return levels;
}

function stripAnnotation(text: string, pattern: RegExp): string {
  pattern.lastIndex = 0;
  return text.replace(pattern, "");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
