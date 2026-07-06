import type { TFile } from "obsidian";
import type { ActionProcessorServices } from "../plugin-context";
import type { PmActionConfig } from "../types";
import { CSS_CLS, BUTTON_OPACITY_DISABLED } from "../constants";
import { COMMAND_IDS } from "../command-ids";

// ─── Action command map ──────────────────────────────────────────────────────

/**
 * Maps action type strings to this plugin's **bare** command IDs, sourced from
 * the single `COMMAND_IDS` registry so a dispatch id can never drift from its
 * registration id. The manifest `id` prefix is applied by `CommandExecutor` at
 * dispatch time, so this map stays rename-proof. Kept as an explicit allowlist:
 * an unknown action type yields `undefined`, which renders a disabled button.
 */
export const ACTION_COMMAND_MAP: Record<string, string> = {
  "create-client": COMMAND_IDS.CREATE_CLIENT,
  "create-engagement": COMMAND_IDS.CREATE_ENGAGEMENT,
  "create-project": COMMAND_IDS.CREATE_PROJECT,
  "create-person": COMMAND_IDS.CREATE_PERSON,
  "create-inbox": COMMAND_IDS.CREATE_INBOX,
  "create-single-meeting": COMMAND_IDS.CREATE_SINGLE_MEETING,
  "create-recurring-meeting": COMMAND_IDS.CREATE_RECURRING_MEETING,
  "create-recurring-meeting-event": COMMAND_IDS.CREATE_RECURRING_MEETING_EVENT,
  "create-project-note": COMMAND_IDS.CREATE_PROJECT_NOTE,
  "convert-inbox": COMMAND_IDS.CONVERT_INBOX,
  "convert-single-to-recurring": COMMAND_IDS.CONVERT_SINGLE_TO_RECURRING,
  "scaffold-vault": COMMAND_IDS.SCAFFOLD_VAULT,
  "create-raid-item": COMMAND_IDS.CREATE_RAID_ITEM,
  "create-reference": COMMAND_IDS.CREATE_REFERENCE,
  "create-reference-topic": COMMAND_IDS.CREATE_REFERENCE_TOPIC,
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
