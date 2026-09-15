import { describe, it, expect, vi, afterEach } from "vitest";
import { ReferenceTopicCreationModal } from "@/ui/modals/reference-topic-creation-modal";
import { PropertySuggest } from "@/ui/components/property-suggest";
import { App } from "../mocks/obsidian-mock";

function makePage(name: string) {
  return { file: { name } } as unknown as import("@/types").DataviewPage;
}

function createModal(topics: ReturnType<typeof makePage>[] = []) {
  const app = new App();
  return new ReferenceTopicCreationModal(
    app as unknown as import("obsidian").App,
    topics
  );
}

function clickButton(modal: ReferenceTopicCreationModal, label: string): void {
  const btn = Array.from(modal.contentEl.querySelectorAll("button")).find(
    (b) => b.textContent === label
  ) as HTMLButtonElement;
  btn.click();
}

/** Selects an option in a PropertySuggest identified by its aria-label. */
function selectSuggestOption(
  modal: ReferenceTopicCreationModal,
  ariaLabel: string,
  optionText: string
): void {
  const input = modal.contentEl.querySelector(
    `[aria-label="${ariaLabel}"]`
  ) as HTMLInputElement;
  input.dispatchEvent(new FocusEvent("focus"));
  const container = input.parentElement!;
  const option = Array.from(
    container.querySelectorAll(".pm-autocomplete__option:not(.pm-autocomplete__option--none)")
  ).find((el) => el.textContent === optionText) as HTMLElement;
  option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("ReferenceTopicCreationModal", () => {
  describe("onOpen() — rendering", () => {
    it("renders name input", () => {
      const modal = createModal();
      modal.onOpen();
      expect(modal.contentEl.querySelector("input[type='text']")).not.toBeNull();
    });

    it("renders Cancel and Create buttons", () => {
      const modal = createModal();
      modal.onOpen();
      const labels = Array.from(modal.contentEl.querySelectorAll("button")).map((b) => b.textContent);
      expect(labels).toContain("Cancel");
      expect(labels).toContain("Create");
    });

    it("uses the shared pm-modal-buttons button row class", () => {
      const modal = createModal();
      modal.onOpen();
      expect(modal.contentEl.querySelector(".pm-modal-buttons")).not.toBeNull();
    });

    it("renders a parent-topic suggest only when topics exist", () => {
      const withTopics = createModal([makePage("Architecture")]);
      withTopics.onOpen();
      expect(withTopics.contentEl.querySelector("[aria-label='Parent topic']")).not.toBeNull();

      const withoutTopics = createModal();
      withoutTopics.onOpen();
      expect(withoutTopics.contentEl.querySelector("[aria-label='Parent topic']")).toBeNull();
    });
  });

  describe("prompt() — settle-once + cleanup", () => {
    it("resolves once with the value when submitted, then still runs onDismiss cleanup on close", async () => {
      const destroySpy = vi.spyOn(PropertySuggest.prototype, "destroy");
      const modal = createModal([makePage("Architecture")]);
      let resolveCount = 0;
      const promise = modal.prompt().then((v) => {
        resolveCount++;
        return v;
      });
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "REST APIs";

      clickButton(modal, "Create");

      // The real Obsidian close() triggers onClose; simulate it here.
      modal.onClose();

      const result = await promise;
      expect(result).toEqual({ name: "REST APIs", parentName: null });
      expect(resolveCount).toBe(1);
      expect(destroySpy).toHaveBeenCalled();
    });

    it("includes the selected parent topic in the result", async () => {
      const modal = createModal([makePage("Architecture"), makePage("Security")]);
      const promise = modal.prompt();
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "REST APIs";
      selectSuggestOption(modal, "Parent topic", "Architecture");

      clickButton(modal, "Create");

      const result = await promise;
      expect(result).toEqual({ name: "REST APIs", parentName: "Architecture" });
    });

    it("does not resolve when Create is clicked with an empty name", async () => {
      const modal = createModal([makePage("Architecture")]);
      let resolved = false;
      modal.prompt().then(() => {
        resolved = true;
      });
      modal.onOpen();

      clickButton(modal, "Create");

      await new Promise((r) => setTimeout(r, 10));
      expect(resolved).toBe(false);

      modal.onClose();
    });
  });

  describe("onClose() — null resolution + cleanup", () => {
    it("resolves with null when dismissed without submitting", async () => {
      const modal = createModal([makePage("Architecture")]);
      const promise = modal.prompt();
      modal.onOpen();

      modal.onClose();

      const result = await promise;
      expect(result).toBeNull();
    });

    it("runs the parent-suggest destroy hook on dismissal", async () => {
      const destroySpy = vi.spyOn(PropertySuggest.prototype, "destroy");
      const modal = createModal([makePage("Architecture")]);
      const promise = modal.prompt();
      modal.onOpen();

      modal.onClose();
      await promise;

      expect(destroySpy).toHaveBeenCalledTimes(1);
    });

    it("does not resolve a second time when closed after cancelling", async () => {
      const modal = createModal([makePage("Architecture")]);
      let resolveCount = 0;
      modal.prompt().then(() => {
        resolveCount++;
      });
      modal.onOpen();

      clickButton(modal, "Cancel");
      modal.onClose();

      await new Promise((r) => setTimeout(r, 10));
      expect(resolveCount).toBe(1);
    });
  });
});
