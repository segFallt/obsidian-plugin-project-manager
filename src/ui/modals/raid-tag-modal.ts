import { App, Modal } from "obsidian";
import type { DataviewPage, RaidType, RaidDirection } from "../../types";
import { FOCUS_DELAY_MS } from "../../constants";

// ─── Direction helpers ────────────────────────────────────────────────────────

interface DirectionOption {
  label: string;
  direction: RaidDirection;
}

/** Returns type-specific direction options for the given RAID type. */
function getDirectionOptions(raidType: RaidType): DirectionOption[] {
  const labels: Record<RaidType, [string, string, string]> = {
    Risk: ["Mitigates", "Escalates", "Notes"],
    Assumption: ["Validates", "Invalidates", "Notes"],
    Issue: ["Resolves", "Compounds", "Notes"],
    Decision: ["Supports", "Challenges", "Notes"],
  };
  const [pos, neg, neu] = labels[raidType];
  return [
    { label: `↑ Positive — ${pos}`, direction: "positive" },
    { label: `↓ Negative — ${neg}`, direction: "negative" },
    { label: `· Neutral — ${neu}`, direction: "neutral" },
  ];
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RaidTagResult {
  itemName: string;
  direction: RaidDirection;
}

export interface RaidTagLabelledItem {
  page: DataviewPage;
  label: string;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

/**
 * Compound modal for "Tag Line as RAID Reference".
 * Presents RAID item selection and relationship direction in a single styled form.
 *
 * Resolves RaidTagResult | null via prompt().
 */
export class RaidTagModal extends Modal {
  private resolvePromise!: (value: RaidTagResult | null) => void;
  private itemSelect!: HTMLSelectElement;
  private directionSelect!: HTMLSelectElement;

  constructor(
    app: App,
    private readonly labelledItems: RaidTagLabelledItem[]
  ) {
    super(app);
  }

  /** Opens the modal and returns a promise that resolves with the user's selection, or null if cancelled. */
  prompt(): Promise<RaidTagResult | null> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Tag Line as RAID Reference" });

    // RAID item select
    const itemGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    itemGroup.createEl("label", { text: "RAID Item" });
    this.itemSelect = itemGroup.createEl("select", { cls: "pm-modal-field__select dropdown" });
    this.itemSelect.style.width = "100%";
    this.itemSelect.style.marginTop = "4px";
    for (const item of this.labelledItems) {
      this.itemSelect.createEl("option", { text: item.label, value: item.page.file.name });
    }

    // Direction select (labels update dynamically when RAID item changes)
    const dirGroup = contentEl.createDiv({ cls: "pm-modal-field" });
    dirGroup.style.marginTop = "12px";
    dirGroup.createEl("label", { text: "Relationship Direction" });
    this.directionSelect = dirGroup.createEl("select", { cls: "pm-modal-field__select dropdown" });
    this.directionSelect.style.width = "100%";
    this.directionSelect.style.marginTop = "4px";

    // Initialise direction options for the first item
    this.refreshDirectionOptions();

    // Refresh direction labels whenever the selected RAID item changes
    this.itemSelect.addEventListener("change", () => this.refreshDirectionOptions());

    // Buttons
    const buttonRow = contentEl.createDiv({ cls: "pm-modal-buttons" });
    buttonRow.style.display = "flex";
    buttonRow.style.justifyContent = "flex-end";
    buttonRow.style.gap = "8px";
    buttonRow.style.marginTop = "16px";

    const cancelBtn = buttonRow.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.cancel());

    const tagBtn = buttonRow.createEl("button", { text: "Tag Line", cls: "mod-cta" });
    tagBtn.addEventListener("click", () => this.submit());

    setTimeout(() => this.itemSelect.focus(), FOCUS_DELAY_MS);
  }

  onClose(): void {
    this.resolvePromise?.(null);
    this.contentEl.empty();
  }

  private refreshDirectionOptions(): void {
    const selectedName = this.itemSelect.value;
    const page = this.labelledItems.find((i) => i.page.file.name === selectedName)?.page;
    const raidType = ((page?.["raid-type"] as RaidType) ?? "Risk");
    const options = getDirectionOptions(raidType);

    // Preserve current direction value if it's still valid
    const currentDirection = this.directionSelect.value;
    this.directionSelect.empty();
    for (const opt of options) {
      this.directionSelect.createEl("option", { text: opt.label, value: opt.direction });
    }
    if (currentDirection) {
      this.directionSelect.value = currentDirection;
    }
  }

  private submit(): void {
    const itemName = this.itemSelect.value;
    const direction = this.directionSelect.value as RaidDirection;
    if (!itemName || !direction) return;

    this.resolvePromise({ itemName, direction });
    this.resolvePromise = () => {};
    this.close();
  }

  private cancel(): void {
    this.resolvePromise(null);
    this.resolvePromise = () => {};
    this.close();
  }
}
