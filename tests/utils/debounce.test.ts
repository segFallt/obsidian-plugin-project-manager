import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounced } from "@/utils/debounce";

describe("debounced", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not invoke fn before the delay elapses", () => {
    const fn = vi.fn();
    const d = debounced(fn, 200);

    d.trigger();
    vi.advanceTimersByTime(199);

    expect(fn).not.toHaveBeenCalled();
  });

  it("invokes fn once after the delay elapses", () => {
    const fn = vi.fn();
    const d = debounced(fn, 200);

    d.trigger();
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("collapses rapid triggers into a single invocation", () => {
    const fn = vi.fn();
    const d = debounced(fn, 200);

    d.trigger();
    vi.advanceTimersByTime(100);
    d.trigger();
    vi.advanceTimersByTime(100);
    d.trigger();
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not run a pending call once cancelled", () => {
    const fn = vi.fn();
    const d = debounced(fn, 200);

    d.trigger();
    d.cancel();
    vi.advanceTimersByTime(1000);

    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel is a no-op when nothing is pending", () => {
    const fn = vi.fn();
    const d = debounced(fn, 200);

    expect(() => d.cancel()).not.toThrow();
    vi.advanceTimersByTime(1000);

    expect(fn).not.toHaveBeenCalled();
  });

  it("can be re-triggered after a cancel", () => {
    const fn = vi.fn();
    const d = debounced(fn, 200);

    d.trigger();
    d.cancel();
    d.trigger();
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
