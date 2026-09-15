import { App, Modal } from "obsidian";

/**
 * Base class for modals that present their result as a Promise.
 *
 * Subclasses call {@link settle} exactly once to resolve with a value and close
 * the modal. If the modal is dismissed without settling (Escape, click-outside,
 * or an external `close()`), the promise resolves to `null`. The settle-once
 * guard ensures the promise can never resolve twice.
 *
 * Subclasses that own disposable resources (autocomplete suggesters, chip
 * selects, etc.) override {@link onDismiss} to release them. The hook runs on
 * every close, before any null-resolution.
 */
export abstract class PromiseModal<T> extends Modal {
  private resolvePromise: ((value: T | null) => void) | undefined;
  private settled = false;

  constructor(app: App) {
    super(app);
  }

  /** Opens the modal and returns a promise that resolves when the user submits or the modal is dismissed. */
  prompt(): Promise<T | null> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }

  /**
   * Resolves the promise once with `value` and closes the modal. Subsequent
   * calls (including the null-resolution in {@link onClose}) are no-ops.
   */
  protected settle(value: T | null): void {
    if (this.settled) return;
    this.settled = true;
    this.resolvePromise?.(value);
    this.close();
  }

  onClose(): void {
    this.onDismiss();
    if (!this.settled) {
      this.settled = true;
      this.resolvePromise?.(null);
    }
    this.contentEl.empty();
  }

  /**
   * Hook for subclasses to release resources on close. Runs on every close,
   * before any null-resolution. The default implementation does nothing.
   */
  protected onDismiss(): void {}
}
