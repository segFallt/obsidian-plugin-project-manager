import { App, FuzzySuggestModal } from "obsidian";
import { FOCUS_DELAY_MS } from "../../constants";

/**
 * A fuzzy-search suggestion modal for selecting from a list of items.
 * Returns a Promise resolving to the selected item, or null if cancelled.
 *
 * Replaces QuickAdd's `suggester()`.
 */
export class SuggesterModal<T> extends FuzzySuggestModal<T> {
  private resolvePromise!: (value: T | null) => void;
  private resolved = false;

  constructor(
    app: App,
    private readonly items: T[],
    private readonly displayFn: (item: T) => string,
    placeholder?: string
  ) {
    super(app);
    if (placeholder) this.setPlaceholder(placeholder);
  }

  /** Opens the modal and returns a promise that resolves to the selected item.
   * The open() call is deferred by FOCUS_DELAY_MS to allow any in-flight DOM
   * events from a preceding modal (e.g. InputModal's Enter keydown) to be
   * processed before this modal receives focus, preventing spurious closes.
   */
  choose(): Promise<T | null> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      setTimeout(() => this.open(), FOCUS_DELAY_MS);
    });
  }

  getItems(): T[] {
    return this.items;
  }

  getItemText(item: T): string {
    return this.displayFn(item);
  }

  onChooseItem(item: T): void {
    this.resolved = true;
    this.resolvePromise(item);
  }

  onClose(): void {
    // Defer null-resolution by one event-loop tick so that onChooseItem() —
    // which Obsidian fires synchronously in the same tick as close() — has a
    // chance to set this.resolved = true first. Without this deferral, every
    // selection silently cancels because onClose() wins the race.
    setTimeout(() => {
      if (!this.resolved) {
        this.resolvePromise(null);
      }
    }, 0);
  }
}

/**
 * Simple string-based suggester — convenience wrapper around SuggesterModal<string>.
 */
export class StringSuggesterModal extends SuggesterModal<string> {
  constructor(app: App, items: string[], placeholder?: string) {
    super(app, items, (s) => s, placeholder);
  }
}
