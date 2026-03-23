import { App, Modal } from "obsidian";
import type { DataviewPage, RaidType } from "../../types";
import { FOCUS_DELAY_MS } from "../../constants";

// ─── Constants ────────────────────────────────────────────────────────────────

const RAID_TYPES: RaidType[] = ["Risk", "Assumption", "Issue", "Decision"];

// ─── Result type ─────────────────────────────────────────────────────────────

export interface RaidItemCreationResult {
  name: string;
  raidType: RaidType;
  engagementName: string | undefined;
  ownerName: string | undefined;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

/**
 * Compound modal for RAID item creation.
 * Collects name, type, optional engagement, and optional owner in a single form.
 */
export class RaidItemCreationModal extends Modal {
  private resolvePromise!: (value: RaidItemCreationResult | null) => void;
  private nameInput!: HTMLInputElement;
  private typeSelect!: HTMLSelectElement;
  private engagementSelect!: HTMLSelectElement;
  private ownerSelect!: HTMLSelectElement;

  constructor(
    app: App,
    private readonly engagements: DataviewPage[],
    private readonly owners: DataviewPage[]
  ) {
    super(app);
  }

  /** Opens the modal and returns a promise that resolves with the user's input, or null if cancelled. */
  prompt(): Promise<RaidItemCreationResult | null> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "New RAID Item" });

    // Name
    const nameGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    nameGroup.createEl("label", { text: "Name" });
    this.nameInput = nameGroup.createEl("input", {
      type: "text",
      placeholder: "e.g. Risk of scope creep",
      cls: "pm-modal-field__input",
    });
    this.nameInput.style.width = "100%";
    this.nameInput.style.marginTop = "4px";

    // RAID Type
    const typeGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    typeGroup.style.marginTop = "12px";
    typeGroup.createEl("label", { text: "RAID Type" });
    this.typeSelect = typeGroup.createEl("select", { cls: "pm-modal-field__select dropdown" });
    this.typeSelect.style.width = "100%";
    this.typeSelect.style.marginTop = "4px";
    for (const t of RAID_TYPES) {
      this.typeSelect.createEl("option", { text: t, value: t });
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

    // Owner (optional)
    const ownerGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    ownerGroup.style.marginTop = "12px";
    ownerGroup.createEl("label", { text: "Owner (optional)" });
    this.ownerSelect = ownerGroup.createEl("select", { cls: "pm-modal-field__select dropdown" });
    this.ownerSelect.style.width = "100%";
    this.ownerSelect.style.marginTop = "4px";
    this.ownerSelect.createEl("option", { text: "(None)", value: "" });
    for (const o of this.owners) {
      this.ownerSelect.createEl("option", { text: o.file.name, value: o.file.name });
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

    const raidType = this.typeSelect.value as RaidType;
    const engagementName = this.engagementSelect.value || undefined;
    const ownerName = this.ownerSelect.value || undefined;

    this.resolvePromise({ name, raidType, engagementName, ownerName });
    this.resolvePromise = () => {};
    this.close();
  }

  private cancel(): void {
    this.resolvePromise(null);
    this.resolvePromise = () => {};
    this.close();
  }
}
