import { MarkdownRenderChild, parseYaml } from "obsidian";
import type { MarkdownPostProcessorContext } from "obsidian";
import type { ActionProcessorServices, RegisterProcessorFn } from "../plugin-context";
import type { PmActionsConfig } from "../types";
import { renderActionButtons } from "./action-renderers";
import { CODEBLOCK, CSS_CLS } from "../constants";

/**
 * Renders action buttons that execute plugin commands.
 *
 * Replaces Meta Bind button blocks (meta-bind-button code blocks).
 *
 * Usage:
 * ```pm-actions
 * actions:
 *   - type: create-project-note
 *     label: New Project Note
 *     style: primary
 *   - type: convert-inbox
 *     label: Convert to Project
 *     style: primary
 * ```
 *
 * Built-in action types map to plugin command IDs.
 * Custom commandId can override the default mapping.
 */
export function registerPmActionsProcessor(
  services: ActionProcessorServices,
  registerProcessor: RegisterProcessorFn
): void {
  registerProcessor(CODEBLOCK.PM_ACTIONS, (source, el, ctx: MarkdownPostProcessorContext) => {
    const child = new PmActionsRenderChild(el, source, ctx.sourcePath, services);
    ctx.addChild(child);
    child.render();
  });
}

class PmActionsRenderChild extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly sourcePath: string,
    private readonly services: ActionProcessorServices
  ) {
    super(containerEl);
  }

  render(): void {
    this.containerEl.empty();

    let config: PmActionsConfig;
    try {
      config = parseYaml(this.source) as PmActionsConfig;
    } catch {
      this.containerEl
        .createDiv({ cls: CSS_CLS.PM_ERROR })
        .setText("Invalid pm-actions config.");
      return;
    }

    if (!Array.isArray(config?.actions) || config.actions.length === 0) {
      return;
    }

    renderActionButtons(this.containerEl, config.actions, this.services, this.sourcePath);
  }
}
