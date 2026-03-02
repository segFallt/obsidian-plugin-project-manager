import { App, Modal } from "obsidian";

/**
 * A simple text input modal with Enter to submit.
 * Returns a Promise that resolves to the entered value, or null if cancelled.
 *
 * Replaces QuickAdd's `inputPrompt()`.
 */
export class InputModal extends Modal {
  private resolvePromise!: (value: string | null) => void;
  private inputEl!: HTMLInputElement;

  constructor(
    app: App,
    private readonly promptText: string,
    private readonly placeholder: string = "",
    private readonly defaultValue: string = ""
  ) {
    super(app);
  }

  /** Opens the modal and returns a promise that resolves when the user submits or cancels. */
  prompt(): Promise<string | null> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
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

    this.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.submit();
      } else if (e.key === "Escape") {
        this.cancel();
      }
    });

    // Button row
    const buttonRow = contentEl.createDiv({ cls: "pm-input-modal__buttons" });
    buttonRow.style.display = "flex";
    buttonRow.style.justifyContent = "flex-end";
    buttonRow.style.gap = "8px";
    buttonRow.style.marginTop = "16px";

    const cancelBtn = buttonRow.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.cancel());

    const submitBtn = buttonRow.createEl("button", {
      text: "OK",
      cls: "mod-cta",
    });
    submitBtn.addEventListener("click", () => this.submit());

    // Focus and select default value
    setTimeout(() => {
      this.inputEl.focus();
      this.inputEl.select();
    }, 10);
  }

  onClose(): void {
    this.resolvePromise?.(null);
    this.contentEl.empty();
  }

  private submit(): void {
    const value = this.inputEl.value.trim();
    this.resolvePromise(value || null);
    this.resolvePromise = () => {}; // prevent double-resolve on close
    this.close();
  }

  private cancel(): void {
    this.resolvePromise(null);
    this.resolvePromise = () => {};
    this.close();
  }
}
