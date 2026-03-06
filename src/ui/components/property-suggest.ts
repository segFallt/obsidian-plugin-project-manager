/**
 * PropertySuggest — combobox widget backed by Obsidian's AbstractInputSuggest.
 *
 * Obsidian portals the suggest popover to document.body, which escapes all
 * overflow clipping and CSS transform stacking-context issues that caused the
 * old fixed-positioned dropdown to render at wrong coordinates inside Obsidian's
 * editor pane.
 *
 * Exposes the same public API as the old InlineAutocomplete:
 *   - inputEl: HTMLInputElement (readonly)
 *   - clear(): void
 *   - reopen(): void
 *   - destroy(): void
 */

import { AbstractInputSuggest, App } from "obsidian";

export interface AutocompleteOption {
  /** Stored value (e.g. entity name) */
  value: string;
  /** Text shown in the dropdown and input after selection */
  displayText: string;
}

export interface AutocompleteConfig {
  placeholder?: string;
  ariaLabel?: string;
  onSelect: (option: AutocompleteOption) => void;
  onClear?: () => void;
  /** Whether to include a "(None)" option at the top. Defaults to true. */
  includeNone?: boolean;
}

// ─── OptionSuggest ────────────────────────────────────────────────────────────

/**
 * Concrete AbstractInputSuggest that filters a fixed list of AutocompleteOptions.
 * Not exported — used only by PropertySuggest.
 */
class OptionSuggest extends AbstractInputSuggest<AutocompleteOption | null> {
  private allOptions: AutocompleteOption[];
  private includeNone: boolean;

  constructor(
    app: App,
    inputEl: HTMLInputElement,
    options: AutocompleteOption[],
    includeNone: boolean
  ) {
    super(app, inputEl);
    this.allOptions = options;
    this.includeNone = includeNone;
  }

  getSuggestions(query: string): (AutocompleteOption | null)[] {
    const q = query.toLowerCase();
    const filtered = q
      ? this.allOptions.filter((o) => o.displayText.toLowerCase().includes(q))
      : [...this.allOptions];

    const items: (AutocompleteOption | null)[] = this.includeNone ? [null] : [];
    items.push(...filtered);
    return items;
  }

  renderSuggestion(item: AutocompleteOption | null, el: HTMLElement): void {
    el.classList.add("pm-autocomplete__option");
    if (item === null) {
      el.textContent = "(None)";
      el.classList.add("pm-autocomplete__option--none");
    } else {
      el.textContent = item.displayText;
    }
  }
}

// ─── PropertySuggest ──────────────────────────────────────────────────────────

export class PropertySuggest {
  readonly inputEl: HTMLInputElement;
  private suggest: OptionSuggest;
  private currentDisplayText: string = "";

  constructor(
    parent: HTMLElement,
    app: App,
    options: AutocompleteOption[],
    currentValue: string | null,
    private readonly config: AutocompleteConfig
  ) {
    // Resolve initial display text from current value
    if (currentValue) {
      const match = options.find((o) => o.value === currentValue);
      this.currentDisplayText = match ? match.displayText : currentValue;
    }

    // Build DOM — same structure as the old InlineAutocomplete
    const containerEl = parent.createDiv({ cls: "pm-autocomplete" });

    this.inputEl = containerEl.createEl("input", {
      cls: "pm-autocomplete__input pm-properties__input",
    });
    this.inputEl.type = "text";
    this.inputEl.placeholder = config.placeholder ?? "";
    this.inputEl.value = this.currentDisplayText;
    this.inputEl.setAttribute("role", "combobox");
    this.inputEl.setAttribute("aria-expanded", "false");
    this.inputEl.setAttribute("aria-autocomplete", "list");
    if (config.ariaLabel) this.inputEl.setAttribute("aria-label", config.ariaLabel);

    const includeNone = config.includeNone !== false;
    this.suggest = new OptionSuggest(app, this.inputEl, options, includeNone);

    this.suggest.onSelect((item) => {
      if (item === null) {
        this.currentDisplayText = "";
        this.inputEl.value = "";
        config.onClear?.();
      } else {
        this.currentDisplayText = item.displayText;
        this.inputEl.value = item.displayText;
        config.onSelect(item);
      }
    });
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Resets the input to empty and closes the suggest popover. */
  clear(): void {
    this.currentDisplayText = "";
    this.inputEl.value = "";
    this.suggest.close();
  }

  /** Opens the suggest popover (used by list-suggester to auto-reopen after selection). */
  reopen(): void {
    this.suggest.open();
  }

  /** Closes the suggest popover. Call when unmounting. */
  destroy(): void {
    this.suggest.close();
  }
}
