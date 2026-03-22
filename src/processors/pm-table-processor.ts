import { MarkdownRenderChild, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type { PropertyProcessorServices, RegisterProcessorFn } from "../plugin-context";
import type { PmTableConfig } from "../types";
import { renderEntityTable } from "./table-renderers";
import { CODEBLOCK, LOG_CONTEXT, ERROR_PADDING } from "../constants";
import { renderError } from "./dom-helpers";

/**
 * Renders entity relationship tables in note context.
 *
 * Replaces dv.view() calls to vault dataview table scripts:
 * - client-engagements  → client-engagements-table.js
 * - client-people       → client-people-table.js
 * - engagement-projects → engagement-projects-table.js
 * - related-project-notes → related-project-note-table.js
 * - mentions            → mentions-table.js
 *
 * Usage:
 * ```pm-table
 * type: client-engagements
 * ```
 */
export function registerPmTableProcessor(
  services: PropertyProcessorServices,
  registerProcessor: RegisterProcessorFn
): void {
  registerProcessor(CODEBLOCK.PM_TABLE, (source, el, ctx: MarkdownPostProcessorContext) => {
    const child = new PmTableRenderChild(el, source, ctx.sourcePath, services);
    ctx.addChild(child);
    child.render();
  });
}

class PmTableRenderChild extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly sourcePath: string,
    private readonly services: PropertyProcessorServices
  ) {
    super(containerEl);
  }

  render(): void {
    this.containerEl.empty();

    let config: PmTableConfig;
    try {
      config = parseYaml(this.source) as PmTableConfig;
    } catch {
      const msg = "Invalid pm-table config: could not parse YAML.";
      this.services.loggerService.warn(msg, LOG_CONTEXT.TABLE_PROCESSOR);
      renderError(this.containerEl, msg, ERROR_PADDING);
      return;
    }

    if (!config?.type) {
      const msg = "pm-table requires a `type` field.";
      this.services.loggerService.warn(msg, LOG_CONTEXT.TABLE_PROCESSOR);
      renderError(this.containerEl, msg, ERROR_PADDING);
      return;
    }

    this.services.loggerService.debug(`pm-table rendering, type: "${config.type}", source: "${this.sourcePath}"`, LOG_CONTEXT.TABLE_PROCESSOR);
    try {
      renderEntityTable(this.containerEl, config.type, this.sourcePath, this.services);
    } catch (err) {
      this.services.loggerService.error(String(err), LOG_CONTEXT.TABLE_PROCESSOR, err);
      renderError(this.containerEl, `pm-table error: ${String(err)}`, ERROR_PADDING);
    }
  }
}
