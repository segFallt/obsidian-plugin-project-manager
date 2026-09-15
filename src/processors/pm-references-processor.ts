import { MarkdownRenderChild, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext, Plugin } from "obsidian";
import type { ReferenceProcessorServices } from "../plugin-context";
import type { DataviewPage, PmReferencesConfig, SavedReferenceFilters } from "../types";
import { renderError } from "./dom-helpers";
import {
  CODEBLOCK,
  CSS_CLS,
  HTML_TAG,
  DOM_EVENT,
  FM_KEY,
  LOG_CONTEXT,
  REFERENCE_DASHBOARD_STATE_KEY,
  REFERENCES_DASHBOARD_MSG,
  REFERENCES_DASHBOARD_TEXT,
} from "../constants";
import { COMMAND_IDS } from "../command-ids";
import { normalizeToName } from "../utils/link-utils";
import { RefQuery } from "../services/ref-query";
import { SettingsViewStore } from "./view-state-store";
import type { ViewState } from "./view-state-store";

/**
 * Renders a compact summary card for the pm-references code block.
 *
 * The full dashboard is hosted in the Reference Dashboard ItemView panel
 * (see `src/views/reference-dashboard-item-view.ts`). This processor renders a
 * lightweight card showing the reference count and a button to open the panel.
 *
 * Usage:
 * ```pm-references
 * viewMode: topic
 * ```
 */
export function registerPmReferencesProcessor(
  plugin: Plugin,
  services: ReferenceProcessorServices
): void {
  plugin.registerMarkdownCodeBlockProcessor(
    CODEBLOCK.PM_REFERENCES,
    (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      const child = new PmReferencesRenderChild(el, source, services);
      ctx.addChild(child);
      child.render();
    }
  );
}

// ─── Render child ─────────────────────────────────────────────────────────────

class PmReferencesRenderChild extends MarkdownRenderChild {
  private readonly refQuery: RefQuery;
  private readonly store: SettingsViewStore;

  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly services: ReferenceProcessorServices
  ) {
    super(containerEl);
    this.refQuery = new RefQuery(() => services.queryService.dv());
    // Shares the item view's state key so the summary card and the dashboard are
    // one writer (read-modify-write), never racing over `referenceDashboardFilters`.
    this.store = new SettingsViewStore(
      () => this.services.settings.ui as unknown as Record<string, unknown>,
      () => this.services.saveSettings()
    );
  }

  render(): void {
    this.containerEl.empty();

    let config: PmReferencesConfig | undefined;
    try {
      if (this.source.trim()) {
        config = parseYaml(this.source) as PmReferencesConfig;
      }
    } catch {
      this.services.loggerService.warn(REFERENCES_DASHBOARD_MSG.INVALID_CONFIG, LOG_CONTEXT.REFERENCES_PROCESSOR);
      renderError(this.containerEl, REFERENCES_DASHBOARD_MSG.INVALID_CONFIG);
      return;
    }

    const topicFilter =
      config?.filter?.topics && config.filter.topics.length > 0
        ? config.filter.topics
        : undefined;

    const count = this.countReferences(topicFilter);

    const card = this.containerEl.createDiv({ cls: CSS_CLS.REFERENCES_SUMMARY });
    card.createSpan({ text: REFERENCES_DASHBOARD_TEXT.SUMMARY_ICON });
    card.createEl(HTML_TAG.H3, { text: REFERENCES_DASHBOARD_TEXT.TITLE });
    card.createEl(HTML_TAG.P, { text: REFERENCES_DASHBOARD_TEXT.referenceCount(count) });

    const openBtn = card.createEl(HTML_TAG.BUTTON, {
      cls: `${CSS_CLS.REFERENCES_SUMMARY_OPEN_BTN} ${CSS_CLS.MOD_CTA}`,
      text: REFERENCES_DASHBOARD_TEXT.OPEN_DASHBOARD,
    });
    openBtn.addEventListener(DOM_EVENT.CLICK, () => {
      void this.openDashboard(topicFilter);
    });
  }

  /** Total references, narrowed to the config topic filter when present (OR within the dimension). */
  private countReferences(topicFilter: string[] | undefined): number {
    const references = this.refQuery.resolve();
    if (!topicFilter) return references.length;
    return references.filter((ref) => referenceMatchesTopics(ref, topicFilter)).length;
  }

  /**
   * Persists the config topic as the pre-selected sidebar node (read-modify-write
   * on the shared state key, so the dashboard's other saved fields survive), then
   * routes through the injected executor so the manifest-id prefix is applied in
   * one place.
   */
  private async openDashboard(topicFilter: string[] | undefined): Promise<void> {
    if (topicFilter) {
      const plainName = normalizeToName(topicFilter[0]);
      if (plainName) {
        const current = (this.store.load(REFERENCE_DASHBOARD_STATE_KEY) as SavedReferenceFilters | null) ?? {};
        await this.store.save(REFERENCE_DASHBOARD_STATE_KEY, { ...current, selectedNode: plainName } as ViewState);
      }
    }
    this.services.commandExecutor.executeCommandById(COMMAND_IDS.OPEN_REFERENCE_DASHBOARD);
  }
}

/** Whether any of the reference's topics matches one of the filter topics (normalized both sides). */
function referenceMatchesTopics(ref: DataviewPage, topicFilter: string[]): boolean {
  const rawTopics = ref[FM_KEY.TOPICS];
  const topics = Array.isArray(rawTopics) ? (rawTopics as unknown[]) : [];
  return topicFilter.some((ft) => topics.some((t) => normalizeToName(t) === normalizeToName(ft)));
}
