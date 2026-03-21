import { MarkdownRenderChild, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type { PropertyProcessorServices, RegisterProcessorFn } from "../plugin-context";
import type { PmTableConfig } from "../types";
import { renderEntityTable } from "./shared-renderers";
import { CODEBLOCK, CSS_CLS, CSS_VAR } from "../constants";

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
      this.services.loggerService.warn(msg, "pm-table");
      this.renderError(msg);
      return;
    }

    if (!config?.type) {
      const msg = "pm-table requires a `type` field.";
      this.services.loggerService.warn(msg, "pm-table");
      this.renderError(msg);
      return;
    }

    this.services.loggerService.debug(`pm-table rendering, type: "${config.type}", source: "${this.sourcePath}"`, 'pm-table');
    try {
      renderEntityTable(this.containerEl, config.type, this.sourcePath, this.services);
    } catch (err) {
      this.services.loggerService.error(String(err), "pm-table", err);
      this.renderError(`pm-table error: ${String(err)}`);
    }
  }

  private renderError(message: string): void {
    const div = this.containerEl.createDiv({ cls: CSS_CLS.PM_ERROR });
    div.style.color = CSS_VAR.TEXT_ERROR;
    div.style.padding = "8px";
    div.textContent = message;
  }
}
