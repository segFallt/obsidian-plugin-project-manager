import { App, Modal } from "obsidian";
import type { DataviewPage } from "../../types";
import { FOCUS_DELAY_MS } from "../../constants";

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
 * Collects name, one or more topics (checkbox list), optional client, and optional engagement.
 *
 * Supports pre-selection of topics, client, and engagement from actionContext.
 */
export class ReferenceCreationModal extends Modal {
  private resolvePromise!: (value: ReferenceCreationResult | null) => void;
  private nameInput!: HTMLInputElement;
  private clientSelect!: HTMLSelectElement;
  private engagementSelect!: HTMLSelectElement;
  private readonly checkedTopics = new Set<string>();

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
    for (const t of preselectedTopics) {
      this.checkedTopics.add(t);
    }
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

    // Topics (checkbox list, at least one required)
    const topicsGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    topicsGroup.style.marginTop = "12px";
    topicsGroup.createEl("label", { text: "Topics (at least one required)" });

    const topicList = topicsGroup.createDiv({ cls: "pm-modal-field__topic-list" });
    topicList.style.maxHeight = "120px";
    topicList.style.overflowY = "auto";
    topicList.style.border = "1px solid var(--background-modifier-border)";
    topicList.style.borderRadius = "var(--radius-m)";
    topicList.style.padding = "4px 6px";
    topicList.style.marginTop = "4px";

    for (const topic of this.topics) {
      const wikilink = `[[${topic.file.name}]]`;
      const row = topicList.createDiv({ cls: "pm-modal-field__topic-row" });
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "6px";
      row.style.padding = "2px 0";

      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.checked = this.checkedTopics.has(wikilink);
      row.createEl("label", { text: topic.file.name });

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          this.checkedTopics.add(wikilink);
        } else {
          this.checkedTopics.delete(wikilink);
        }
      });
    }

    // Client (optional)
    const clientGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    clientGroup.style.marginTop = "12px";
    clientGroup.createEl("label", { text: "Client (optional)" });
    this.clientSelect = clientGroup.createEl("select", { cls: "pm-modal-field__select dropdown" });
    this.clientSelect.style.width = "100%";
    this.clientSelect.style.marginTop = "4px";
    this.clientSelect.createEl("option", { text: "(None)", value: "" });
    for (const c of this.clients) {
      this.clientSelect.createEl("option", { text: c.file.name, value: c.file.name });
    }
    if (this.preselectedClient) {
      this.clientSelect.value = this.preselectedClient;
    }

    // Engagement (optional)
    const engGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    engGroup.style.marginTop = "12px";
    engGroup.createEl("label", { text: "Engagement (optional)" });
    this.engagementSelect = engGroup.createEl("select", { cls: "pm-modal-field__select dropdown" });
    this.engagementSelect.style.width = "100%";
    this.engagementSelect.style.marginTop = "4px";
    this.engagementSelect.createEl("option", { text: "(None)", value: "" });
    for (const e of this.engagements) {
      this.engagementSelect.createEl("option", { text: e.file.name, value: e.file.name });
    }
    if (this.preselectedEngagement) {
      this.engagementSelect.value = this.preselectedEngagement;
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
    this.resolvePromise?.(null);
    this.contentEl.empty();
  }

  private submit(): void {
    const name = this.nameInput.value.trim();
    if (!name) return;

    const topics = [...this.checkedTopics];
    if (topics.length === 0) return;

    const clientName = this.clientSelect.value || undefined;
    const engagementName = this.engagementSelect.value || undefined;

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
