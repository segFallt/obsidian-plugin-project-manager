import type { DataviewPage } from "../../types";
import type { ReferenceProcessorServices } from "../../plugin-context";
import { normalizeToName } from "../../utils/link-utils";
import { CSS_CLS, CSS_VAR } from "../../constants";

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Renders references grouped by topic.
 * References with multiple topics appear in each relevant group.
 */
export function renderTopicView(
  container: HTMLElement,
  references: DataviewPage[],
  _services: ReferenceProcessorServices
): void {
  // Group references by each of their topics (fan-out: reference may appear in multiple groups)
  const groups = new Map<string, DataviewPage[]>();
  for (const ref of references) {
    const topics = Array.isArray(ref.topics) ? ref.topics : ref.topics ? [ref.topics] : [];
    for (const t of topics) {
      const name = normalizeToName(t) ?? "";
      if (!name) continue;
      let bucket = groups.get(name);
      if (!bucket) {
        bucket = [];
        groups.set(name, bucket);
      }
      bucket.push(ref);
    }
  }

  // Sort groups alphabetically
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  if (sortedGroups.length === 0) {
    renderEmptyState(container, "No references found.");
    return;
  }

  for (const [topicName, refs] of sortedGroups) {
    const groupBody = renderCollapsibleGroup(container, topicName, refs.length);
    for (const ref of refs) {
      const primaryTopic =
        Array.isArray(ref.topics) && ref.topics.length > 0
          ? (normalizeToName(ref.topics[0]) ?? "")
          : ref.topics
          ? (normalizeToName(ref.topics) ?? "")
          : "";
      const isSecondary = primaryTopic !== topicName && primaryTopic !== "";
      renderReferenceCard(groupBody, ref, isSecondary ? `also in ${primaryTopic}` : undefined);
    }
  }
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Renders a collapsible group header (title + count badge + arrow).
 * Returns the body element for card insertion.
 */
export function renderCollapsibleGroup(
  container: HTMLElement,
  title: string,
  count: number
): HTMLElement {
  const details = container.createEl("details", { cls: "pm-ref-group" });
  details.setAttribute("open", "");

  const summary = details.createEl("summary", { cls: "pm-ref-group__header" });
  summary.createSpan({ cls: "pm-ref-group__title", text: title });
  summary.createSpan({ cls: "pm-ref-group__count", text: String(count) });

  const body = details.createDiv({ cls: "pm-ref-group__body" });
  return body;
}

/**
 * Renders a single reference card with title link, context chips, and optional hint tag.
 */
export function renderReferenceCard(
  container: HTMLElement,
  ref: DataviewPage,
  hint?: string
): void {
  const card = container.createDiv({ cls: "pm-ref-card" });

  // Title row: document icon + internal link
  const titleRow = card.createDiv({ cls: "pm-ref-card__title-row" });
  titleRow.createSpan({ cls: "pm-ref-card__icon", text: "📄" });
  const link = titleRow.createEl("a", {
    cls: CSS_CLS.INTERNAL_LINK,
    text: ref.file.name,
  });
  link.setAttribute("data-href", ref.file.path);
  link.setAttribute("href", ref.file.path);

  if (hint) {
    titleRow.createSpan({ cls: "pm-ref-card__hint", text: hint });
  }

  // Context chips row
  const chipsRow = card.createDiv({ cls: "pm-ref-card__chips" });

  // Topic chips
  const topics = Array.isArray(ref.topics) ? ref.topics : ref.topics ? [ref.topics] : [];
  for (const t of topics) {
    const name = normalizeToName(t);
    if (name) {
      chipsRow.createSpan({ cls: "pm-ref-chip pm-ref-chip--topic", text: name });
    }
  }

  // Client chip
  const clientName = normalizeToName(ref.client);
  if (clientName) {
    chipsRow.createSpan({ cls: "pm-ref-chip pm-ref-chip--client", text: clientName });
  }

  // Engagement chip
  const engagementName = normalizeToName(ref.engagement);
  if (engagementName) {
    chipsRow.createSpan({ cls: "pm-ref-chip pm-ref-chip--engagement", text: engagementName });
  }
}

/**
 * Renders a muted "empty state" message when no references match.
 */
export function renderEmptyState(container: HTMLElement, message: string): void {
  const el = container.createEl("p", { cls: "pm-ref-empty", text: message });
  el.style.color = CSS_VAR.TEXT_MUTED;
  el.style.fontStyle = "italic";
}
