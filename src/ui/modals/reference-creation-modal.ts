import { App, Modal } from "obsidian";
import type { DataviewPage } from "../../types";
import { FOCUS_DELAY_MS } from "../../constants";
import { FilterChipSelect } from "../components/filter-chip-select";
import { PropertySuggest } from "../components/property-suggest";
import type { AutocompleteOption } from "../components/property-suggest";

// ─── Result type ─────────────────────────────────────────────────────────────

export interface ReferenceCreationResult {
  name: string;
  /** Wikilink strings, e.g. ["[[Architecture]]", "[[Security]]"] */
  topics: string[];
  clientName: string | undefined;
  engagementName: string | undefined;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

/**
 * Compound modal for Reference creation.
 * Collects name, one or more topics (FilterChipSelect with type-ahead), optional client,
 * and optional engagement (both via PropertySuggest).
 *
 * Supports pre-selection of topics, client, and engagement from actionContext.
 */
export class ReferenceCreationModal extends Modal {
  private resolvePromise!: (value: ReferenceCreationResult | null) => void;
  private nameInput!: HTMLInputElement;
  private selectedTopics: string[];
  private selectedClientName: string | undefined;
  private selectedEngagementName: string | undefined;
  private topicChipSelect: FilterChipSelect | undefined;
  private clientSuggest: PropertySuggest | undefined;
  private engagementSuggest: PropertySuggest | undefined;

  constructor(
    app: App,
    private readonly topics: DataviewPage[],
    private readonly clients: DataviewPage[],
    private readonly engagements: DataviewPage[],
    preselectedTopics: string[] = [],
    private readonly preselectedClient?: string,
    private readonly preselectedEngagement?: string
  ) {
    super(app);
    this.selectedTopics = [...preselectedTopics];
    this.selectedClientName = preselectedClient;
    this.selectedEngagementName = preselectedEngagement;
  }

  /** Opens the modal and returns a promise that resolves with the user's input, or null if cancelled. */
  prompt(): Promise<ReferenceCreationResult | null> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "New Reference" });

    // Name
    const nameGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    nameGroup.createEl("label", { text: "Name" });
    this.nameInput = nameGroup.createEl("input", {
      type: "text",
      placeholder: "e.g. Clean Architecture",
      cls: "pm-modal-field__input",
    });
    this.nameInput.style.width = "100%";
    this.nameInput.style.marginTop = "4px";

    // Topics (FilterChipSelect with type-ahead, at least one required)
    const topicsGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    topicsGroup.style.marginTop = "12px";
    topicsGroup.createEl("label", { text: "Topics (at least one required)" });

    const topicOptions: AutocompleteOption[] = this.topics.map((t) => ({
      displayText: t.file.name,
      value: `[[${t.file.name}]]`,
    }));

    this.topicChipSelect = new FilterChipSelect(topicsGroup, this.app, {
      options: topicOptions,
      selectedValues: this.selectedTopics,
      placeholder: "Search topics…",
      ariaLabel: "Topics",
      showUnassignedCheckbox: false,
      onChange: (selectedValues) => {
        this.selectedTopics = selectedValues;
      },
    });

    // Client (optional, PropertySuggest)
    const clientGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    clientGroup.style.marginTop = "12px";
    clientGroup.createEl("label", { text: "Client (optional)" });

    const clientOptions: AutocompleteOption[] = this.clients.map((c) => ({
      displayText: c.file.name,
      value: c.file.name,
    }));

    this.clientSuggest = new PropertySuggest(
      clientGroup,
      this.app,
      clientOptions,
      this.preselectedClient ?? null,
      {
        placeholder: "Search clients…",
        ariaLabel: "Client",
        includeNone: true,
        onSelect: (option) => {
          this.selectedClientName = option.value;
        },
        onClear: () => {
          this.selectedClientName = undefined;
        },
      }
    );

    // Engagement (optional, PropertySuggest)
    const engGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    engGroup.style.marginTop = "12px";
    engGroup.createEl("label", { text: "Engagement (optional)" });

    const engagementOptions: AutocompleteOption[] = this.engagements.map((e) => ({
      displayText: e.file.name,
      value: e.file.name,
    }));

    this.engagementSuggest = new PropertySuggest(
      engGroup,
      this.app,
      engagementOptions,
      this.preselectedEngagement ?? null,
      {
        placeholder: "Search engagements…",
        ariaLabel: "Engagement",
        includeNone: true,
        onSelect: (option) => {
          this.selectedEngagementName = option.value;
        },
        onClear: () => {
          this.selectedEngagementName = undefined;
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
    this.topicChipSelect?.destroy();
    this.clientSuggest?.destroy();
    this.engagementSuggest?.destroy();
    this.resolvePromise?.(null);
    this.contentEl.empty();
  }

  private submit(): void {
    const name = this.nameInput.value.trim();
    if (!name) return;

    const topics = this.selectedTopics;
    if (topics.length === 0) return;

    const clientName = this.selectedClientName;
    const engagementName = this.selectedEngagementName;

    this.resolvePromise({ name, topics, clientName, engagementName });
    this.resolvePromise = () => {};
    this.close();
  }

  private cancel(): void {
    this.resolvePromise(null);
    this.resolvePromise = () => {};
    this.close();
  }
}
