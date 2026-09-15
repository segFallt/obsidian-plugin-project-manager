/**
 * A debounced wrapper around a function: repeated `trigger()` calls collapse
 * into a single deferred invocation, and `cancel()` drops any pending call.
 */
export interface Debounced {
  /** (Re)starts the timer; `fn` runs once `ms` elapse without another trigger. */
  trigger(): void;
  /** Clears any pending call so it never runs. Safe to call when nothing is pending. */
  cancel(): void;
}

/**
 * Creates a debounced wrapper around `fn`.
 *
 * Each `trigger()` restarts a single shared timer, so `fn` runs at most once per
 * quiet window of `ms`. Call `cancel()` from an owner's teardown
 * (`onunload` / `onClose`) to guarantee a scheduled call does not fire after the
 * owner is gone — this is what prevents a leaked timer.
 *
 * @param fn Callback invoked when the debounce window elapses.
 * @param ms Quiet-window length in milliseconds.
 */
export function debounced(fn: () => void, ms: number): Debounced {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    trigger(): void {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, ms);
    },
    cancel(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
