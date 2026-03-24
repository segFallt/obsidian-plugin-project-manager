import type { App } from "obsidian";
import { PropertySuggest } from "./property-suggest";
import type { AutocompleteOption } from "./property-suggest";

export type { AutocompleteOption };

export interface FilterChipSelectConfig {
  options: AutocompleteOption[];
  selectedValues: string[];
  placeholder: string;
  ariaLabel: string;
  includeUnassigned?: boolean;
  unassignedLabel?: string;
  showUnassignedCheckbox?: boolean;
  onChange: (selectedValues: string[], includeUnassigned: boolean) => void;
}

/**
 * Reusable multi-select filter component that combines chips with a PropertySuggest
 * type-ahead input. Used by DashboardView and ByProjectView for client/engagement filters.
 *
 * DOM layout:
 *   .pm-filter-chip-select
 *     .pm-filter-chip-select__chips
 *       .pm-filter-chip-select__chip  ×N
 *     .pm-autocomplete (PropertySuggest)
 *     label.pm-checkbox-label
 *       input[type=checkbox]
 *       span (unassignedLabel)
 */
export class FilterChipSelect {
  private selectedValues: string[];
  private includeUnassigned: boolean;
  private suggest: PropertySuggest;
  private chipsEl: HTMLElement;
  private unassignedCb: HTMLInputElement | undefined;

  constructor(
    container: HTMLElement,
    app: App,
    private readonly config: FilterChipSelectConfig
  ) {
    this.selectedValues = [...config.selectedValues];
    this.includeUnassigned = config.includeUnassigned ?? false;

    const wrapper = container.createDiv({ cls: "pm-filter-chip-select" });

    // Chips container
    this.chipsEl = wrapper.createDiv({ cls: "pm-filter-chip-select__chips" });
    this.renderChips();

    // PropertySuggest input (no "(None)" — we don't allow de-selecting via suggest)
    this.suggest = new PropertySuggest(wrapper, app, config.options, null, {
      placeholder: config.placeholder,
      ariaLabel: config.ariaLabel,
      includeNone: false,
      onSelect: (option) => {
        if (!this.selectedValues.includes(option.value)) {
          this.selectedValues = [...this.selectedValues, option.value];
          this.renderChips();
          this.config.onChange(this.selectedValues, this.includeUnassigned);
        }
        this.suggest.clear();
        this.suggest.reopen();
      },
    });

    // "Include unassigned" checkbox
    if (config.showUnassignedCheckbox !== false) {
      const unassignedLabel = wrapper.createEl("label", { cls: "pm-checkbox-label" });
      const unassignedCb = unassignedLabel.createEl("input", { type: "checkbox" });
      this.unassignedCb = unassignedCb;
      unassignedCb.checked = this.includeUnassigned;
      unassignedCb.setAttribute("aria-label", config.unassignedLabel ?? "");
      unassignedLabel.createSpan({ text: config.unassignedLabel ?? "" });
      unassignedCb.addEventListener("change", () => {
        this.includeUnassigned = unassignedCb.checked;
        this.config.onChange(this.selectedValues, this.includeUnassigned);
      });
    }
  }

  /** Releases the underlying PropertySuggest. */
  destroy(): void {
    this.suggest.destroy();
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private renderChips(): void {
    this.chipsEl.empty();
    for (const value of this.selectedValues) {
      const option = this.config.options.find((o) => o.value === value);
      const displayText = option ? option.displayText : value;

      const chip = this.chipsEl.createSpan({ cls: "pm-filter-chip-select__chip" });
      chip.createSpan({ text: displayText });
      const removeBtn = chip.createSpan({
        text: "×",
        cls: "pm-filter-chip-select__chip-remove",
      });
      removeBtn.addEventListener("click", () => {
        this.selectedValues = this.selectedValues.filter((v) => v !== value);
        this.renderChips();
        this.config.onChange(this.selectedValues, this.includeUnassigned);
      });
    }
  }
}
