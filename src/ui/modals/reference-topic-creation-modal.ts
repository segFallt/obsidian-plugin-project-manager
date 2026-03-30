import { App, Modal } from "obsidian";
import type { DataviewPage } from "../../types";
import { FOCUS_DELAY_MS } from "../../constants";
import { PropertySuggest } from "../components/property-suggest";
import type { AutocompleteOption } from "../components/property-suggest";

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
export class ReferenceTopicCreationModal extends Modal {
  private resolvePromise!: (value: ReferenceTopicCreationResult | null) => void;
  private nameInput!: HTMLInputElement;
  private selectedParentName: string | null = null;
  private parentSuggest: PropertySuggest | undefined;

  constructor(
    app: App,
    private readonly topics: DataviewPage[]
  ) {
    super(app);
  }

  prompt(): Promise<ReferenceTopicCreationResult | null> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
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
    const buttonRow = contentEl.createDiv({ cls: "pm-modal-buttons" });
    buttonRow.style.display = "flex";
    buttonRow.style.justifyContent = "flex-end";
    buttonRow.style.gap = "8px";
    buttonRow.style.marginTop = "16px";

    const cancelBtn = buttonRow.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.cancel());

    const createBtn = buttonRow.createEl("button", { text: "Create", cls: "mod-cta" });
    createBtn.addEventListener("click", () => this.submit());

    this.nameInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.submit();
      } else if (e.key === "Escape") {
        this.cancel();
      }
    });

    setTimeout(() => this.nameInput.focus(), FOCUS_DELAY_MS);
  }

  onClose(): void {
    this.parentSuggest?.destroy();
    this.resolvePromise?.(null);
    this.contentEl.empty();
  }

  private submit(): void {
    const name = this.nameInput.value.trim();
    if (!name) return;
    this.resolvePromise({ name, parentName: this.selectedParentName });
    this.resolvePromise = () => {};
    this.close();
  }

  private cancel(): void {
    this.resolvePromise(null);
    this.resolvePromise = () => {};
    this.close();
  }
}
