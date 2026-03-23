import { describe, it, expect, vi, afterEach } from "vitest";
import { SuggesterModal, StringSuggesterModal } from "../../src/ui/modals/suggester-modal";
import { App } from "../mocks/obsidian-mock";

function createSuggester<T>(items: T[], displayFn?: (item: T) => string) {
  const app = new App();
  return new SuggesterModal<T>(
    app as unknown as import("obsidian").App,
    items,
    displayFn ?? ((item) => String(item))
  );
}

describe("SuggesterModal", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("getItems() returns the provided items", () => {
    const modal = createSuggester(["apple", "banana", "cherry"]);
    expect(modal.getItems()).toEqual(["apple", "banana", "cherry"]);
  });

  it("getItemText() delegates to the displayFn", () => {
    const displayFn = vi.fn((s: string) => s.toUpperCase());
    const modal = createSuggester(["hello"], displayFn);
    expect(modal.getItemText("hello")).toBe("HELLO");
    expect(displayFn).toHaveBeenCalledWith("hello");
  });

  it("onChooseItem() resolves the promise with the selected item", async () => {
    const modal = createSuggester(["a", "b", "c"]);
    const promise = modal.choose();
    modal.onChooseItem("b");
    const result = await promise;
    expect(result).toBe("b");
  });

  it("onClose() without selection resolves with null", async () => {
    vi.useFakeTimers();
    const modal = createSuggester(["a", "b"]);
    const promise = modal.choose();
    vi.runAllTimers(); // flush FOCUS_DELAY_MS so open() fires
    modal.onClose();
    vi.runAllTimers(); // flush the setTimeout(0) in onClose
    const result = await promise;
    expect(result).toBeNull();
  });

  it("onClose() before onChooseItem() resolves with the item (race-condition fix)", async () => {
    vi.useFakeTimers();
    const modal = createSuggester(["a", "b"]);
    const promise = modal.choose();
    vi.runAllTimers(); // flush FOCUS_DELAY_MS
    // Simulate Obsidian's ordering: close() fires onClose() before onChooseItem()
    modal.onClose();
    modal.onChooseItem("a", new MouseEvent("click"));
    vi.runAllTimers(); // flush the deferred null-resolution timeout
    const result = await promise;
    expect(result).toBe("a");
  });

  it("onClose() after selection does not double-resolve to null", async () => {
    const modal = createSuggester(["a", "b"]);
    const promise = modal.choose();
    modal.onChooseItem("a");
    modal.onClose(); // Should be a no-op since already resolved
    const result = await promise;
    expect(result).toBe("a");
  });

  it("choose() defers open() to avoid event bleed-through from a preceding modal", () => {
    vi.useFakeTimers();
    const modal = createSuggester(["a", "b"]);
    const openSpy = vi.spyOn(modal, "open").mockImplementation(() => {});

    modal.choose();

    // open() must NOT be called synchronously — a stale Enter keydown from
    // the preceding InputModal would otherwise immediately close this modal.
    expect(openSpy).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(openSpy).toHaveBeenCalledOnce();
  });
});

describe("StringSuggesterModal", () => {
  it("passes items and identity display function", () => {
    const app = new App();
    const modal = new StringSuggesterModal(
      app as unknown as import("obsidian").App,
      ["foo", "bar", "baz"]
    );
    expect(modal.getItems()).toEqual(["foo", "bar", "baz"]);
    expect(modal.getItemText("foo")).toBe("foo");
  });

  it("resolves with the selected string", async () => {
    const app = new App();
    const modal = new StringSuggesterModal(
      app as unknown as import("obsidian").App,
      ["option1", "option2"]
    );
    const promise = modal.choose();
    modal.onChooseItem("option2");
    const result = await promise;
    expect(result).toBe("option2");
  });
});
