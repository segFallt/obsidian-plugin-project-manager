import { App } from "obsidian";
import type { DataviewPage } from "../../types";
import { FOCUS_DELAY_MS, ACTION_LABEL } from "../../constants";
import { PropertySuggest } from "../components/property-suggest";
import type { AutocompleteOption } from "../../types";
import { PromiseModal } from "./promise-modal";
import { createModalButtonRow, registerSubmitCancelKeys } from "./modal-controls";

export interface ReferenceTopicCreationResult {
  name: string;
  parentName: string | null;
}

/**
 * Modal for PM: Create Reference Topic.
 *
 * Collects a name (text input) and an optional parent topic (PropertySuggest).
 * Follows the ReferenceCreationModal pattern.
 */
export class ReferenceTopicCreationModal extends PromiseModal<ReferenceTopicCreationResult> {
  private nameInput!: HTMLInputElement;
  private selectedParentName: string | null = null;
  private parentSuggest: PropertySuggest | undefined;

  constructor(
    app: App,
    private readonly topics: DataviewPage[]
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "New Reference Topic" });

    // Name
    const nameGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    nameGroup.createEl("label", { text: "Name" });
    this.nameInput = nameGroup.createEl("input", {
      type: "text",
      placeholder: "e.g. Architecture",
      cls: "pm-modal-field__input",
    });
    this.nameInput.style.width = "100%";
    this.nameInput.style.marginTop = "4px";

    // Parent topic (optional, PropertySuggest)
    if (this.topics.length > 0) {
      const parentGroup = contentEl.createDiv({ cls: "pm-modal-field" });
      parentGroup.style.marginTop = "12px";
      parentGroup.createEl("label", { text: "Parent topic (optional)" });

      const topicOptions: AutocompleteOption[] = this.topics.map((t) => ({
        displayText: t.file.name,
        value: t.file.name,
      }));

      this.parentSuggest = new PropertySuggest(
        parentGroup,
        this.app,
        topicOptions,
        null,
        {
          placeholder: "Search topics…",
          ariaLabel: "Parent topic",
          includeNone: true,
          onSelect: (option) => {
            this.selectedParentName = option.value;
          },
          onClear: () => {
            this.selectedParentName = null;
          },
        }
      );
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

  protected onDismiss(): void {
    this.parentSuggest?.destroy();
  }

  private submit(): void {
    const name = this.nameInput.value.trim();
    if (!name) return;
    this.settle({ name, parentName: this.selectedParentName });
  }

  private cancel(): void {
    this.settle(null);
  }
}
