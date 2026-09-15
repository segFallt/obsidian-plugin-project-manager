import { describe, it, expect, vi, afterEach } from "vitest";
import { ReferenceTopicUpdateModal } from "@/ui/modals/reference-topic-update-modal";
import { PropertySuggest } from "@/ui/components/property-suggest";
import { App } from "../mocks/obsidian-mock";

function makePage(name: string) {
  return { file: { name } } as unknown as import("@/types").DataviewPage;
}

function createModal(topics: ReturnType<typeof makePage>[] = []) {
  const app = new App();
  return new ReferenceTopicUpdateModal(
    app as unknown as import("obsidian").App,
    topics
  );
}

function clickButton(modal: ReferenceTopicUpdateModal, label: string): void {
  const btn = Array.from(modal.contentEl.querySelectorAll("button")).find(
    (b) => b.textContent === label
  ) as HTMLButtonElement;
  btn.click();
}

/** Selects an option in a PropertySuggest identified by its aria-label. */
function selectSuggestOption(
  modal: ReferenceTopicUpdateModal,
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

describe("ReferenceTopicUpdateModal", () => {
  describe("onOpen() — rendering", () => {
    it("renders 'Topic to update' and 'New parent' suggests", () => {
      const modal = createModal([makePage("Architecture")]);
      modal.onOpen();
      expect(modal.contentEl.querySelector("[aria-label='Topic to update']")).not.toBeNull();
      expect(modal.contentEl.querySelector("[aria-label='New parent topic']")).not.toBeNull();
    });

    it("renders Cancel and Save buttons using the shared button row", () => {
      const modal = createModal([makePage("Architecture")]);
      modal.onOpen();
      const labels = Array.from(modal.contentEl.querySelectorAll("button")).map((b) => b.textContent);
      expect(labels).toContain("Cancel");
      expect(labels).toContain("Save");
      expect(modal.contentEl.querySelector(".pm-modal-buttons")).not.toBeNull();
    });
  });

  describe("prompt() — settle-once + cleanup", () => {
    it("resolves once with the value when submitted, then still runs onDismiss cleanup on close", async () => {
      const destroySpy = vi.spyOn(PropertySuggest.prototype, "destroy");
      const modal = createModal([makePage("Architecture"), makePage("Security")]);
      let resolveCount = 0;
      const promise = modal.prompt().then((v) => {
        resolveCount++;
        return v;
      });
      modal.onOpen();

      selectSuggestOption(modal, "Topic to update", "Architecture");
      selectSuggestOption(modal, "New parent topic", "Security");

      clickButton(modal, "Save");

      // The real Obsidian close() triggers onClose; simulate it here.
      modal.onClose();

      const result = await promise;
      expect(result).toEqual({ topicName: "Architecture", parentName: "Security" });
      expect(resolveCount).toBe(1);
      // Both suggests are destroyed on close.
      expect(destroySpy).toHaveBeenCalledTimes(2);
    });

    it("resolves with a null parent when only a topic is chosen", async () => {
      const modal = createModal([makePage("Architecture"), makePage("Security")]);
      const promise = modal.prompt();
      modal.onOpen();

      selectSuggestOption(modal, "Topic to update", "Architecture");

      clickButton(modal, "Save");

      const result = await promise;
      expect(result).toEqual({ topicName: "Architecture", parentName: null });
    });

    it("does not resolve when Save is clicked without a topic selected", async () => {
      const modal = createModal([makePage("Architecture")]);
      let resolved = false;
      modal.prompt().then(() => {
        resolved = true;
      });
      modal.onOpen();

      clickButton(modal, "Save");

      await new Promise((r) => setTimeout(r, 10));
      expect(resolved).toBe(false);

      modal.onClose();
    });

    it("does not resolve when a topic is set as its own parent", async () => {
      const modal = createModal([makePage("Architecture"), makePage("Security")]);
      let resolved = false;
      modal.prompt().then(() => {
        resolved = true;
      });
      modal.onOpen();

      // Choose the parent first (full option list), then the same topic.
      selectSuggestOption(modal, "New parent topic", "Architecture");
      selectSuggestOption(modal, "Topic to update", "Architecture");

      clickButton(modal, "Save");

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

    it("destroys both suggests on dismissal", async () => {
      const destroySpy = vi.spyOn(PropertySuggest.prototype, "destroy");
      const modal = createModal([makePage("Architecture")]);
      const promise = modal.prompt();
      modal.onOpen();

      modal.onClose();
      await promise;

      expect(destroySpy).toHaveBeenCalledTimes(2);
    });
  });
});
