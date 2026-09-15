import { App } from "obsidian";
import { FOCUS_DELAY_MS, ACTION_LABEL } from "../../constants";
import { PromiseModal } from "./promise-modal";
import { createModalButtonRow, registerSubmitCancelKeys } from "./modal-controls";

/**
 * A simple text input modal with Enter to submit.
 * Returns a Promise that resolves to the entered value, or null if cancelled.
 *
 * Replaces QuickAdd's `inputPrompt()`.
 */
export class InputModal extends PromiseModal<string> {
  private inputEl!: HTMLInputElement;

  constructor(
    app: App,
    private readonly promptText: string,
    private readonly placeholder: string = "",
    private readonly defaultValue: string = ""
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h3", { text: this.promptText });

    this.inputEl = contentEl.createEl("input", {
      type: "text",
      placeholder: this.placeholder,
      value: this.defaultValue,
      cls: "pm-input-modal__input",
    });
    this.inputEl.style.width = "100%";
    this.inputEl.style.marginTop = "8px";

    registerSubmitCancelKeys(this.inputEl, {
      onSubmit: () => this.submit(),
      onCancel: () => this.cancel(),
    });

    createModalButtonRow(contentEl, {
      submitText: ACTION_LABEL.OK,
      onSubmit: () => this.submit(),
      onCancel: () => this.cancel(),
    });

    // Focus and select default value
    setTimeout(() => {
      this.inputEl.focus();
      this.inputEl.select();
    }, FOCUS_DELAY_MS);
  }

  private submit(): void {
    const value = this.inputEl.value.trim();
    this.settle(value || null);
  }

  private cancel(): void {
    this.settle(null);
  }
}
