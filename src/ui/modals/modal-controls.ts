/**
 * Shared UI helpers for promise-based modals: a right-aligned button row and
 * submit/cancel keyboard handling. Centralises the markup and styling that the
 * field modals previously duplicated.
 */

import { HTML_TAG, DOM_EVENT, ACTION_LABEL } from "../../constants";

const MODAL_BUTTONS_CLASS = "pm-modal-buttons";
const CTA_BUTTON_CLASS = "mod-cta";
const BUTTON_ROW_GAP = "8px";
const BUTTON_ROW_MARGIN_TOP = "16px";

const KEY_ENTER = "Enter";
const KEY_ESCAPE = "Escape";

export interface ModalButtonRowOptions {
  /** Label for the primary (mod-cta) button, e.g. "OK", "Create", "Save". */
  submitText: string;
  /** Label for the secondary button. Defaults to "Cancel". */
  cancelText?: string;
  onSubmit: () => void;
  onCancel: () => void;
}

export interface ModalButtonRow {
  buttonRow: HTMLDivElement;
  cancelBtn: HTMLButtonElement;
  submitBtn: HTMLButtonElement;
}

/**
 * Appends a right-aligned Cancel/submit button row to `contentEl` with click
 * handlers wired. The submit button carries the `mod-cta` class.
 */
export function createModalButtonRow(
  contentEl: HTMLElement,
  options: ModalButtonRowOptions
): ModalButtonRow {
  const buttonRow = contentEl.createDiv({ cls: MODAL_BUTTONS_CLASS });
  buttonRow.style.display = "flex";
  buttonRow.style.justifyContent = "flex-end";
  buttonRow.style.gap = BUTTON_ROW_GAP;
  buttonRow.style.marginTop = BUTTON_ROW_MARGIN_TOP;

  const cancelBtn = buttonRow.createEl(HTML_TAG.BUTTON, {
    text: options.cancelText ?? ACTION_LABEL.CANCEL,
  });
  cancelBtn.addEventListener(DOM_EVENT.CLICK, () => options.onCancel());

  const submitBtn = buttonRow.createEl(HTML_TAG.BUTTON, {
    text: options.submitText,
    cls: CTA_BUTTON_CLASS,
  });
  submitBtn.addEventListener(DOM_EVENT.CLICK, () => options.onSubmit());

  return { buttonRow, cancelBtn, submitBtn };
}

export interface SubmitCancelKeyHandlers {
  onSubmit: () => void;
  onCancel: () => void;
}

/**
 * Wires Enter → submit (with `preventDefault`) and Escape → cancel on the given
 * element.
 */
export function registerSubmitCancelKeys(
  el: HTMLElement,
  handlers: SubmitCancelKeyHandlers
): void {
  el.addEventListener(DOM_EVENT.KEYDOWN, (e: KeyboardEvent) => {
    if (e.key === KEY_ENTER) {
      e.preventDefault();
      handlers.onSubmit();
    } else if (e.key === KEY_ESCAPE) {
      handlers.onCancel();
    }
  });
}
