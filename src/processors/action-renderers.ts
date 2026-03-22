import type { TFile } from "obsidian";
import type { ActionProcessorServices } from "../plugin-context";
import type { PmActionConfig } from "../types";
import { PLUGIN_ID, CSS_CLS, BUTTON_OPACITY_DISABLED } from "../constants";

// ─── Action command map ──────────────────────────────────────────────────────

/** Maps action type strings to plugin command IDs. */
export const ACTION_COMMAND_MAP: Record<string, string> = {
  "create-client": `${PLUGIN_ID}:create-client`,
  "create-engagement": `${PLUGIN_ID}:create-engagement`,
  "create-project": `${PLUGIN_ID}:create-project`,
  "create-person": `${PLUGIN_ID}:create-person`,
  "create-inbox": `${PLUGIN_ID}:create-inbox`,
  "create-single-meeting": `${PLUGIN_ID}:create-single-meeting`,
  "create-recurring-meeting": `${PLUGIN_ID}:create-recurring-meeting`,
  "create-recurring-meeting-event": `${PLUGIN_ID}:create-recurring-meeting-event`,
  "create-project-note": `${PLUGIN_ID}:create-project-note`,
  "convert-inbox": `${PLUGIN_ID}:convert-inbox`,
  "convert-single-to-recurring": `${PLUGIN_ID}:convert-single-to-recurring`,
  "scaffold-vault": `${PLUGIN_ID}:scaffold-vault`,
  "create-raid-item":       `${PLUGIN_ID}:create-raid-item`,
  "create-reference":       `${PLUGIN_ID}:create-reference`,
  "create-reference-topic": `${PLUGIN_ID}:create-reference-topic`,
};

// ─── Action buttons ──────────────────────────────────────────────────────────

/**
 * Renders a row of action buttons that execute plugin commands.
 * When an action has a `context` field, sets the action context on services
 * so the target command can auto-populate its parent entity field.
 *
 * @param container   - Parent element to append the button row to
 * @param actions     - Action descriptors from the config
 * @param services    - Action processor services (commandExecutor, actionContext)
 * @param sourcePath  - Path of the note containing this block (for context value)
 */
export function renderActionButtons(
  container: HTMLElement,
  actions: PmActionConfig[],
  services: ActionProcessorServices,
  sourcePath?: string
): void {
  if (!Array.isArray(actions) || actions.length === 0) return;

  const buttonRow = container.createDiv({ cls: CSS_CLS.ACTIONS_WRAPPER });
  for (const action of actions) {
    renderButton(buttonRow, action, services, sourcePath);
  }
}

function renderButton(
  container: HTMLElement,
  action: PmActionConfig,
  services: ActionProcessorServices,
  sourcePath?: string
): void {
  const commandId = action.commandId ?? ACTION_COMMAND_MAP[action.type];

  const cls: string[] = [CSS_CLS.ACTIONS_BUTTON];
  if (action.style === "primary") cls.push(CSS_CLS.MOD_CTA);
  if (action.style === "destructive") cls.push(CSS_CLS.MOD_DESTRUCTIVE);

  const btn = container.createEl("button", {
    text: action.label,
    cls: cls.join(" "),
  });

  if (!commandId) {
    btn.disabled = true;
    btn.title = `Unknown action type: ${action.type}`;
    btn.style.opacity = String(BUTTON_OPACITY_DISABLED);
    return;
  }

  btn.addEventListener("click", () => {
    if (action.context && sourcePath) {
      const currentFile = services.app.vault.getAbstractFileByPath(sourcePath);
      if (currentFile && "basename" in currentFile) {
        services.actionContext.set({
          field: action.context.field,
          value: (currentFile as TFile).basename,
        });
      }
    }
    services.commandExecutor.executeCommandById(commandId);
  });
}
