/**
 * InlineAutocomplete — reusable combobox widget.
 *
 * Renders an input that opens a dropdown of options on focus, supports
 * substring filtering, keyboard navigation, and ARIA attributes for
 * accessibility.
 */

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

export class InlineAutocomplete {
  readonly inputEl: HTMLInputElement;
  private dropdownEl: HTMLDivElement;
  private containerEl: HTMLDivElement;
  private allOptions: AutocompleteOption[];
  private filteredOptions: AutocompleteOption[];
  private activeIndex: number = -1;
  private isOpen: boolean = false;
  private currentDisplayText: string = "";
  private readonly boundOnDocMousedown: (e: MouseEvent) => void;

  constructor(
    parent: HTMLElement,
    options: AutocompleteOption[],
    currentValue: string | null,
    private readonly config: AutocompleteConfig
  ) {
    this.allOptions = options;
    this.filteredOptions = [...options];

    // Resolve initial display text from current value
    if (currentValue) {
      const match = options.find((o) => o.value === currentValue);
      this.currentDisplayText = match ? match.displayText : currentValue;
    }

    // Build DOM
    this.containerEl = parent.createDiv({ cls: "pm-autocomplete" });

    this.inputEl = this.containerEl.createEl("input", {
      cls: "pm-autocomplete__input pm-properties__input",
    });
    this.inputEl.type = "text";
    this.inputEl.placeholder = config.placeholder ?? "";
    this.inputEl.value = this.currentDisplayText;
    this.inputEl.setAttribute("role", "combobox");
    this.inputEl.setAttribute("aria-expanded", "false");
    this.inputEl.setAttribute("aria-autocomplete", "list");
    if (config.ariaLabel) this.inputEl.setAttribute("aria-label", config.ariaLabel);

    this.dropdownEl = this.containerEl.createDiv({
      cls: "pm-autocomplete__dropdown",
    });
    this.dropdownEl.setAttribute("role", "listbox");
    this.dropdownEl.style.display = "none";

    // Wire up listeners
    this.inputEl.addEventListener("focus", () => this.open());
    this.inputEl.addEventListener("input", () => this.onInput());
    this.inputEl.addEventListener("keydown", (e) => this.onKeydown(e));

    this.boundOnDocMousedown = (e: MouseEvent) => this.onDocMousedown(e);
    document.addEventListener("mousedown", this.boundOnDocMousedown);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Resets the input to empty and closes the dropdown. */
  clear(): void {
    this.currentDisplayText = "";
    this.inputEl.value = "";
    this.close();
  }

  /** Removes the document-level mousedown listener. Call when unmounting. */
  destroy(): void {
    document.removeEventListener("mousedown", this.boundOnDocMousedown);
  }

  // ─── Open / close ─────────────────────────────────────────────────────────

  private open(): void {
    this.filteredOptions = this.getFiltered(this.inputEl.value);
    this.activeIndex = -1;
    this.renderDropdown();
    this.dropdownEl.style.display = "";
    this.inputEl.setAttribute("aria-expanded", "true");
    this.isOpen = true;
  }

  private close(): void {
    this.dropdownEl.style.display = "none";
    this.inputEl.setAttribute("aria-expanded", "false");
    this.isOpen = false;
    this.activeIndex = -1;
  }

  // ─── Event handlers ───────────────────────────────────────────────────────

  private onInput(): void {
    this.filteredOptions = this.getFiltered(this.inputEl.value);
    this.activeIndex = -1;
    this.renderDropdown();
    if (!this.isOpen) {
      this.dropdownEl.style.display = "";
      this.inputEl.setAttribute("aria-expanded", "true");
      this.isOpen = true;
    }
  }

  private onKeydown(e: KeyboardEvent): void {
    if (!this.isOpen) return;

    const totalItems = this.buildItemList().length;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        this.activeIndex = totalItems === 0 ? -1 : (this.activeIndex + 1) % totalItems;
        this.renderDropdown();
        this.scrollActiveIntoView();
        break;
      case "ArrowUp":
        e.preventDefault();
        if (totalItems === 0) break;
        this.activeIndex = this.activeIndex <= 0 ? totalItems - 1 : this.activeIndex - 1;
        this.renderDropdown();
        this.scrollActiveIntoView();
        break;
      case "Enter":
        e.preventDefault();
        if (this.activeIndex >= 0) {
          const items = this.buildItemList();
          const item = items[this.activeIndex];
          if (item) this.select(item);
        }
        break;
      case "Escape":
        e.preventDefault();
        this.inputEl.value = this.currentDisplayText;
        this.close();
        break;
    }
  }

  private onDocMousedown(e: MouseEvent): void {
    if (!this.containerEl.contains(e.target as Node)) {
      this.inputEl.value = this.currentDisplayText;
      this.close();
    }
  }

  // ─── Selection ────────────────────────────────────────────────────────────

  private select(option: AutocompleteOption | null): void {
    if (option === null) {
      // (None) selected
      this.currentDisplayText = "";
      this.inputEl.value = "";
      this.config.onClear?.();
    } else {
      this.currentDisplayText = option.displayText;
      this.inputEl.value = option.displayText;
      this.config.onSelect(option);
    }
    this.close();
  }

  // ─── Dropdown rendering ───────────────────────────────────────────────────

  private getFiltered(query: string): AutocompleteOption[] {
    if (!query) return [...this.allOptions];
    const q = query.toLowerCase();
    return this.allOptions.filter((o) => o.displayText.toLowerCase().includes(q));
  }

  /** Returns the ordered list of items to display: optionally (None) first, then filtered options. */
  private buildItemList(): Array<AutocompleteOption | null> {
    const includeNone = this.config.includeNone !== false;
    const items: Array<AutocompleteOption | null> = includeNone ? [null] : [];
    items.push(...this.filteredOptions);
    return items;
  }

  private renderDropdown(): void {
    this.dropdownEl.empty();
    const items = this.buildItemList();

    if (items.length === 0 || (items.length === 1 && items[0] === null && this.filteredOptions.length === 0)) {
      // No real matches — still show (None) if applicable, plus no-results
      if (this.config.includeNone !== false) {
        this.renderNoneOption(0);
      }
      if (this.filteredOptions.length === 0) {
        const noResults = this.dropdownEl.createDiv({ cls: "pm-autocomplete__no-results" });
        noResults.textContent = "No matches";
      }
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === null) {
        this.renderNoneOption(i);
      } else {
        this.renderOption(item, i);
      }
    }
  }

  private renderNoneOption(index: number): void {
    const el = this.dropdownEl.createDiv({
      cls: "pm-autocomplete__option pm-autocomplete__option--none",
    });
    el.setAttribute("role", "option");
    el.textContent = "(None)";
    if (index === this.activeIndex) el.classList.add("pm-autocomplete__option--active");
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.select(null);
    });
  }

  private renderOption(option: AutocompleteOption, index: number): void {
    const el = this.dropdownEl.createDiv({ cls: "pm-autocomplete__option" });
    el.setAttribute("role", "option");
    el.textContent = option.displayText;
    if (index === this.activeIndex) el.classList.add("pm-autocomplete__option--active");
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.select(option);
    });
  }

  private scrollActiveIntoView(): void {
    const active = this.dropdownEl.querySelector(".pm-autocomplete__option--active");
    (active as HTMLElement)?.scrollIntoView?.({ block: "nearest" });
  }
}
