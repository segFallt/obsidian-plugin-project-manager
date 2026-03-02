import { MarkdownRenderChild, parseYaml } from "obsidian";
import type ProjectManagerPlugin from "../main";
import type { PmActionsConfig, PmActionConfig } from "../types";

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
export function registerPmActionsProcessor(plugin: ProjectManagerPlugin): void {
  plugin.registerMarkdownCodeBlockProcessor("pm-actions", (source, el, ctx) => {
    const child = new PmActionsRenderChild(el, source, plugin);
    ctx.addChild(child);
    child.render();
  });
}

/** Maps action type strings to plugin command IDs. */
const ACTION_COMMAND_MAP: Record<string, string> = {
  "create-client": "project-manager:create-client",
  "create-engagement": "project-manager:create-engagement",
  "create-project": "project-manager:create-project",
  "create-person": "project-manager:create-person",
  "create-inbox": "project-manager:create-inbox",
  "create-single-meeting": "project-manager:create-single-meeting",
  "create-recurring-meeting": "project-manager:create-recurring-meeting",
  "create-project-note": "project-manager:create-project-note",
  "convert-inbox": "project-manager:convert-inbox",
  "scaffold-vault": "project-manager:scaffold-vault",
};

class PmActionsRenderChild extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private readonly source: string,
    private readonly plugin: ProjectManagerPlugin
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
        .createDiv({ cls: "pm-error" })
        .setText("Invalid pm-actions config.");
      return;
    }

    if (!Array.isArray(config?.actions) || config.actions.length === 0) {
      return;
    }

    const buttonRow = this.containerEl.createDiv({ cls: "pm-actions" });

    for (const action of config.actions) {
      this.renderButton(buttonRow, action);
    }
  }

  private renderButton(container: HTMLElement, action: PmActionConfig): void {
    const commandId = action.commandId ?? ACTION_COMMAND_MAP[action.type];

    const cls = ["pm-actions__button"];
    if (action.style === "primary") cls.push("mod-cta");
    if (action.style === "destructive") cls.push("mod-destructive");

    const btn = container.createEl("button", {
      text: action.label,
      cls: cls.join(" "),
    });

    if (!commandId) {
      btn.disabled = true;
      btn.title = `Unknown action type: ${action.type}`;
      btn.style.opacity = "0.5";
      return;
    }

    btn.addEventListener("click", () => {
      (this.plugin.app as unknown as { commands: { executeCommandById: (id: string) => void } })
        .commands.executeCommandById(commandId);
    });
  }
}
