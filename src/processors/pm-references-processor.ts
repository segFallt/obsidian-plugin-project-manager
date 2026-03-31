import { MarkdownRenderChild, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext, Plugin } from "obsidian";
import type { ReferenceProcessorServices } from "../plugin-context";
import type { PmReferencesConfig } from "../types";
import { renderError } from "./dom-helpers";
import { CODEBLOCK } from "../constants";
import { normalizeToName } from "../utils/link-utils";

/**
 * Renders a compact summary card for the pm-references code block.
 *
 * The full dashboard is now hosted in the Reference Dashboard ItemView panel
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
  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly services: ReferenceProcessorServices
  ) {
    super(containerEl);
  }

  render(): void {
    this.containerEl.empty();

    let config: PmReferencesConfig | undefined;
    try {
      if (this.source.trim()) {
        config = parseYaml(this.source) as PmReferencesConfig;
      }
    } catch {
      const msg = "Invalid pm-references config.";
      this.services.loggerService.warn(msg, "pm-references-processor");
      renderError(this.containerEl, msg);
      return;
    }

    const topicFilter =
      config?.filter?.topics && config.filter.topics.length > 0
        ? config.filter.topics
        : undefined;

    const references = this.services.queryService.getReferences(
      topicFilter ? { topics: topicFilter } : {}
    );
    const count = references.length;

    const card = this.containerEl.createDiv({ cls: "pm-references-summary" });
    card.createSpan({ text: "📚" });
    card.createEl("h3", { text: "Reference Dashboard" });
    card.createEl("p", {
      text: `${count} reference${count === 1 ? "" : "s"} in your vault`,
    });

    const openBtn = card.createEl("button", {
      cls: "pm-references-summary__open-btn mod-cta",
      text: "Open Dashboard →",
    });
    openBtn.addEventListener("click", () => {
      void (async () => {
        if (topicFilter) {
          const plainName = normalizeToName(topicFilter[0]);
          if (plainName) {
            this.services.settings.ui.referenceDashboardFilters.selectedNode = plainName;
            await this.services.saveSettings();
          }
        }

        // app.commands is not in the public Obsidian API type definitions but is
        // a stable internal API used across the plugin ecosystem for command dispatch.
        type AppWithCommands = { commands: { executeCommandById(id: string): void } };
        (this.services.app as unknown as AppWithCommands).commands.executeCommandById(
          "project-manager:open-reference-dashboard"
        );
      })();
    });
  }
}
