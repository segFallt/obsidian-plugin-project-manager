import { TFile } from "obsidian";
import type { App, Plugin } from "obsidian";
import type { RaidType, RaidDirection } from "../types";
import { DIRECTION_LABELS, DIRECTION_ICONS } from "./raid-constants";

// Generic fallback labels when raid-type cannot be resolved
const GENERIC_LABELS: Record<RaidDirection, string> = {
  positive: "Supports",
  negative: "Challenges",
  neutral: "Notes",
};

const ANNOTATION_RE = /\{raid:(positive|negative|neutral)\}/;

// ─── Exported registration function ─────────────────────────────────────────

export function registerRaidBadgePostProcessor(plugin: Plugin & { app: App }): void {
  plugin.registerMarkdownPostProcessor((el: HTMLElement) => {
    // Collect text nodes first to avoid mutating the DOM during tree traversal
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const nodesToProcess: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (ANNOTATION_RE.test((node as Text).textContent || "")) {
        nodesToProcess.push(node as Text);
      }
    }

    for (const textNode of nodesToProcess) {
      processRaidAnnotationNode(textNode, plugin.app);
    }
  });
}

// ─── Node processing ─────────────────────────────────────────────────────────

function processRaidAnnotationNode(textNode: Text, app: App): void {
  const content = textNode.textContent ?? "";
  const match = ANNOTATION_RE.exec(content);
  if (!match) return;

  const direction = match[1] as RaidDirection;

  // Find adjacent internal link element to resolve raid-type
  const raidType = resolveRaidTypeFromSibling(textNode, app);
  const label = raidType
    ? (DIRECTION_LABELS[direction]?.[raidType] ?? GENERIC_LABELS[direction])
    : GENERIC_LABELS[direction];

  // Build badge element
  const badge = document.createElement("span");
  badge.className = `raid-badge raid-badge--${direction}`;
  badge.textContent = `${DIRECTION_ICONS[direction]} ${label}`;

  // Split the text node around the annotation pattern and replace it with the badge
  const annotationStart = content.indexOf(match[0]);
  const annotationEnd = annotationStart + match[0].length;

  const parent = textNode.parentNode;
  if (!parent) return;

  const beforeText = content.slice(0, annotationStart);
  const afterText = content.slice(annotationEnd);

  // Insert before badge: remaining text before annotation
  if (beforeText) {
    parent.insertBefore(document.createTextNode(beforeText), textNode);
  }

  // Insert badge
  parent.insertBefore(badge, textNode);

  // Update the original text node to contain only the text after the annotation
  textNode.textContent = afterText;
}

// ─── Resolve raid-type from neighbouring link ────────────────────────────────

function resolveRaidTypeFromSibling(textNode: Text, app: App): RaidType | null {
  // Look for the next sibling element that is an internal-link anchor
  let sibling: Node | null = textNode.nextSibling;
  while (sibling) {
    if (sibling.nodeType === Node.ELEMENT_NODE) {
      const el = sibling as HTMLElement;
      if (el.tagName === "A" && el.classList.contains("internal-link")) {
        const href = el.getAttribute("data-href") ?? el.getAttribute("href") ?? "";
        if (href) {
          return resolveRaidTypeFromPath(href, app);
        }
      }
      break; // Stop at first element sibling
    }
    sibling = sibling.nextSibling;
  }
  return null;
}

function resolveRaidTypeFromPath(linkedPath: string, app: App): RaidType | null {
  // Normalise — strip leading slash and .md extension
  const normalised = linkedPath.replace(/^\//, "").replace(/\.md$/, "");

  // Try to find the file in the vault by path or by basename
  const file = app.vault.getAbstractFileByPath(`${normalised}.md`)
    ?? app.vault.getAbstractFileByPath(normalised);

  if (!(file instanceof TFile)) return null;

  const cache = app.metadataCache.getFileCache(file);
  const raidType: unknown = cache?.frontmatter?.["raid-type"];

  if (typeof raidType === "string" && ["Risk", "Assumption", "Issue", "Decision"].includes(raidType)) {
    return raidType as RaidType;
  }

  return null;
}
