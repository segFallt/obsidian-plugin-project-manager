import { App, Notice } from "obsidian";
import type { DataviewPage } from "../../types";
import { FOCUS_DELAY_MS, ACTION_LABEL } from "../../constants";
import { PropertySuggest } from "../components/property-suggest";
import type { AutocompleteOption } from "../../types";
import { PromiseModal } from "./promise-modal";
import { createModalButtonRow } from "./modal-controls";

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
export class ReferenceTopicUpdateModal extends PromiseModal<ReferenceTopicUpdateResult> {
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
    createModalButtonRow(contentEl, {
      submitText: ACTION_LABEL.SAVE,
      onSubmit: () => this.submit(),
      onCancel: () => this.cancel(),
    });

    setTimeout(() => this.topicSuggest?.inputEl.focus(), FOCUS_DELAY_MS);
  }

  protected onDismiss(): void {
    this.topicSuggest?.destroy();
    this.parentSuggest?.destroy();
  }

  private submit(): void {
    if (!this.selectedTopicName) return;
    if (this.selectedParentName === this.selectedTopicName) {
      new Notice("A topic cannot be its own parent.");
      return;
    }
    this.settle({ topicName: this.selectedTopicName, parentName: this.selectedParentName });
  }

  private cancel(): void {
    this.settle(null);
  }
}
