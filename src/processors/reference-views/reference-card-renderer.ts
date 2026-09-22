import { TFile } from "obsidian";
import type { App } from "obsidian";
import type { DataviewPage, TopicNode } from "../../types";
import type { INavigationService, ILoggerService } from "../../services/interfaces";
import { normalizeToName } from "../../utils/link-utils";
import { createInternalLink } from "../dom-helpers";
import { CSS_CLS, HTML_TAG, DOM_ATTR, FM_KEY, LOG_CONTEXT, REFERENCES_DASHBOARD_TEXT } from "../../constants";

/** Minimal service subset required by {@link renderReferenceCard}. */
export type CardNavigationServices = {
  app: App;
  navigationService: INavigationService;
  loggerService: ILoggerService;
};

/**
 * Read-only, precomputed lookups the reference view renderers draw from. The
 * host (dashboard view) resolves the UNFILTERED reference set and topic tree up
 * front — the shell only hands renderers the filtered items — so the flat
 * sidebars and topic tree render from a stable, filter-independent node-set.
 */
export interface RefRenderHelpers {
  /** Full reference-topic tree (from {@link RefQuery.getReferenceTopicTree}). */
  topicTree: TopicNode[];
  /** Every reference in the vault (unfiltered), for building the flat sidebars. */
  allReferences: DataviewPage[];
  /** Navigation collaborators a reference card links through. */
  cardServices: CardNavigationServices;
}

/**
 * Renders a collapsible group header (title + count badge + arrow).
 * Returns the body element for card insertion.
 */
export function renderCollapsibleGroup(
  container: HTMLElement,
  title: string,
  count: number
): HTMLElement {
  const details = container.createEl(HTML_TAG.DETAILS, { cls: CSS_CLS.REF_GROUP });
  details.setAttribute(DOM_ATTR.OPEN, "");

  const summary = details.createEl(HTML_TAG.SUMMARY, { cls: CSS_CLS.REF_GROUP_HEADER });
  summary.createSpan({ cls: CSS_CLS.REF_GROUP_TITLE, text: title });
  summary.createSpan({ cls: CSS_CLS.REF_GROUP_COUNT, text: String(count) });

  const body = details.createDiv({ cls: CSS_CLS.REF_GROUP_BODY });
  return body;
}

/**
 * Renders a single reference card with title link, context chips, and optional hint tag.
 */
export function renderReferenceCard(
  container: HTMLElement,
  ref: DataviewPage,
  services: CardNavigationServices,
  hint?: string
): void {
  const card = container.createDiv({ cls: CSS_CLS.REF_CARD });

  // Title row: document icon + internal link
  const titleRow = card.createDiv({ cls: CSS_CLS.REF_CARD_TITLE_ROW });
  titleRow.createSpan({ cls: CSS_CLS.REF_CARD_ICON, text: REFERENCES_DASHBOARD_TEXT.CARD_ICON });
  createInternalLink(titleRow, ref.file.path, ref.file.name, {
    onClick: () => {
      const file = services.app.vault.getAbstractFileByPath(ref.file.path);
      if (file instanceof TFile) {
        void services.navigationService
          .openFile(file)
          .catch((err) => services.loggerService.error(String(err), LOG_CONTEXT.REFERENCE_DASHBOARD_VIEW, err));
      }
    },
  });

  if (hint) {
    titleRow.createSpan({ cls: CSS_CLS.REF_CARD_HINT, text: hint });
  }

  // Context chips row
  const chipsRow = card.createDiv({ cls: CSS_CLS.REF_CARD_CHIPS });

  // Topic chips
  const rawTopics = ref[FM_KEY.TOPICS];
  const topics = Array.isArray(rawTopics) ? rawTopics : rawTopics ? [rawTopics] : [];
  for (const t of topics) {
    const name = normalizeToName(t);
    if (name) {
      chipsRow.createSpan({ cls: `${CSS_CLS.REF_CHIP} ${CSS_CLS.REF_CHIP_TOPIC}`, text: name });
    }
  }

  // Client chip
  const clientName = normalizeToName(ref[FM_KEY.CLIENT]);
  if (clientName) {
    chipsRow.createSpan({ cls: `${CSS_CLS.REF_CHIP} ${CSS_CLS.REF_CHIP_CLIENT}`, text: clientName });
  }

  // Engagement chip
  const engagementName = normalizeToName(ref[FM_KEY.ENGAGEMENT]);
  if (engagementName) {
    chipsRow.createSpan({ cls: `${CSS_CLS.REF_CHIP} ${CSS_CLS.REF_CHIP_ENGAGEMENT}`, text: engagementName });
  }
}

/**
 * Renders a muted "empty state" message when no references match. The muted
 * colour and italic styling come from the `.pm-ref-empty` CSS rule.
 */
export function renderEmptyState(container: HTMLElement, message: string): void {
  container.createEl(HTML_TAG.P, { cls: CSS_CLS.REF_EMPTY, text: message });
}
