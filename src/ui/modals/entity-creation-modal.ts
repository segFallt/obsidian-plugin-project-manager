import { App } from "obsidian";
import type { DataviewPage } from "../../types";
import { FOCUS_DELAY_MS, ACTION_LABEL } from "../../constants";
import { PromiseModal } from "./promise-modal";
import { createModalButtonRow, registerSubmitCancelKeys } from "./modal-controls";

export interface EntityCreationResult {
  name: string;
  parentName: string | null;
}

/**
 * Compound modal for entity creation: name input + optional parent entity selection.
 *
 * Replaces the combination of QuickAdd inputPrompt + suggester for entity creation flows.
 */
export class EntityCreationModal extends PromiseModal<EntityCreationResult> {
  private nameInput!: HTMLInputElement;
  private parentSelect!: HTMLSelectElement;

  constructor(
    app: App,
    private readonly title: string,
    private readonly namePlaceholder: string,
    private readonly parentLabel: string | null,
    private readonly parentOptions: DataviewPage[],
    private readonly preselectedParent?: string
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h3", { text: this.title });

    // Name input
    const nameGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    nameGroup.createEl("label", { text: "Name" });
    this.nameInput = nameGroup.createEl("input", {
      type: "text",
      placeholder: this.namePlaceholder,
      cls: "pm-modal-field__input",
    });
    this.nameInput.style.width = "100%";
    this.nameInput.style.marginTop = "4px";

    // Parent entity select (if applicable)
    if (this.parentLabel && this.parentOptions.length > 0) {
      const parentGroup = contentEl.createDiv({ cls: "pm-modal-field" });
      parentGroup.style.marginTop = "12px";
      parentGroup.createEl("label", { text: this.parentLabel });

      this.parentSelect = parentGroup.createEl("select", {
        cls: "pm-modal-field__select dropdown",
      });
      this.parentSelect.style.width = "100%";
      this.parentSelect.style.marginTop = "4px";

      // Add "None" option
      const noneOption = this.parentSelect.createEl("option", {
        text: "(None)",
        value: "",
      });
      noneOption.selected = true;

      // Sort active first, then alphabetically
      const sorted = [...this.parentOptions].sort((a, b) => {
        const aActive = a.status === "Active" ? 0 : 1;
        const bActive = b.status === "Active" ? 0 : 1;
        if (aActive !== bActive) return aActive - bActive;
        return a.file.name.localeCompare(b.file.name);
      });

      for (const page of sorted) {
        this.parentSelect.createEl("option", {
          text: page.file.name,
          value: page.file.name,
        });
      }

      if (this.preselectedParent) {
        this.parentSelect.value = this.preselectedParent;
      }
    }

    // Buttons
    createModalButtonRow(contentEl, {
      submitText: ACTION_LABEL.CREATE,
      onSubmit: () => this.submit(),
      onCancel: () => this.cancel(),
    });

    registerSubmitCancelKeys(this.nameInput, {
      onSubmit: () => this.submit(),
      onCancel: () => this.cancel(),
    });

    setTimeout(() => this.nameInput.focus(), FOCUS_DELAY_MS);
  }

  private submit(): void {
    const name = this.nameInput.value.trim();
    if (!name) return;

    const parentName = this.parentSelect?.value || null;
    this.settle({ name, parentName });
  }

  private cancel(): void {
    this.settle(null);
  }
}
