import { App, Modal, Notice } from "obsidian";
import type { DataviewPage } from "../../types";
import { FOCUS_DELAY_MS } from "../../constants";
import { PropertySuggest } from "../components/property-suggest";
import type { AutocompleteOption } from "../components/property-suggest";

export interface ReferenceTopicUpdateResult {
  topicName: string;
  parentName: string | null;
}

/**
 * Modal for PM: Update Reference Topic.
 *
 * Uses PropertySuggest for both "topic to update" and "new parent" fields.
 * Prevents setting a topic as its own parent (validated on submit).
 */
export class ReferenceTopicUpdateModal extends Modal {
  private resolvePromise!: (value: ReferenceTopicUpdateResult | null) => void;
  private selectedTopicName: string | null = null;
  private selectedParentName: string | null = null;
  private topicSuggest: PropertySuggest | undefined;
  private parentSuggest: PropertySuggest | undefined;

  constructor(
    app: App,
    private readonly topics: DataviewPage[]
  ) {
    super(app);
  }

  prompt(): Promise<ReferenceTopicUpdateResult | null> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Update Reference Topic" });

    const topicOptions: AutocompleteOption[] = [...this.topics]
      .sort((a, b) => a.file.name.localeCompare(b.file.name))
      .map((t) => ({ displayText: t.file.name, value: t.file.name }));

    // Topic to update (required)
    const topicGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    topicGroup.createEl("label", { text: "Topic to update" });

    this.topicSuggest = new PropertySuggest(
      topicGroup,
      this.app,
      topicOptions,
      null,
      {
        placeholder: "Search topics…",
        ariaLabel: "Topic to update",
        includeNone: false,
        onSelect: (option) => {
          this.selectedTopicName = option.value;
          // Exclude the selected topic from parent options (PRD-002 §3.10)
          this.parentSuggest?.updateOptions(
            topicOptions.filter((o) => o.value !== option.value)
          );
        },
        onClear: () => {
          this.selectedTopicName = null;
          this.parentSuggest?.updateOptions(topicOptions);
        },
      }
    );

    // New parent (optional)
    const parentGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    parentGroup.style.marginTop = "12px";
    parentGroup.createEl("label", { text: "New parent (optional)" });

    this.parentSuggest = new PropertySuggest(
      parentGroup,
      this.app,
      topicOptions,
      null,
      {
        placeholder: "Search topics…",
        ariaLabel: "New parent topic",
        includeNone: true,
        onSelect: (option) => {
          this.selectedParentName = option.value;
        },
        onClear: () => {
          this.selectedParentName = null;
        },
      }
    );

    // Buttons
    const buttonRow = contentEl.createDiv({ cls: "pm-modal-buttons" });
    buttonRow.style.display = "flex";
    buttonRow.style.justifyContent = "flex-end";
    buttonRow.style.gap = "8px";
    buttonRow.style.marginTop = "16px";

    const cancelBtn = buttonRow.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.cancel());

    const saveBtn = buttonRow.createEl("button", { text: "Save", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => this.submit());

    setTimeout(() => this.topicSuggest?.inputEl.focus(), FOCUS_DELAY_MS);
  }

  onClose(): void {
    this.topicSuggest?.destroy();
    this.parentSuggest?.destroy();
    this.resolvePromise?.(null);
    this.contentEl.empty();
  }

  private submit(): void {
    if (!this.selectedTopicName) return;
    if (this.selectedParentName === this.selectedTopicName) {
      new Notice("A topic cannot be its own parent.");
      return;
    }
    this.resolvePromise({ topicName: this.selectedTopicName, parentName: this.selectedParentName });
    this.resolvePromise = () => {};
    this.close();
  }

  private cancel(): void {
    this.resolvePromise(null);
    this.resolvePromise = () => {};
    this.close();
  }
}
