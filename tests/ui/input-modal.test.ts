import { describe, it, expect, vi } from "vitest";
import { InputModal } from "../../src/ui/modals/input-modal";
import { App } from "../mocks/obsidian-mock";

function createModal(promptText = "Enter value:", placeholder = "", defaultValue = "") {
  const app = new App();
  const modal = new InputModal(
    app as unknown as import("obsidian").App,
    promptText,
    placeholder,
    defaultValue
  );
  return modal;
}

describe("InputModal", () => {
  describe("onOpen()", () => {
    it("creates a heading, input, and button row", () => {
      const modal = createModal("Test prompt:");
      modal.onOpen();

      const heading = modal.contentEl.querySelector("h3");
      expect(heading?.textContent).toBe("Test prompt:");

      const input = modal.contentEl.querySelector("input");
      expect(input).not.toBeNull();

      const buttons = modal.contentEl.querySelectorAll("button");
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it("populates input with defaultValue", () => {
      const modal = createModal("Label:", "", "pre-filled value");
      modal.onOpen();

      const input = modal.contentEl.querySelector("input") as HTMLInputElement;
      expect(input.value).toBe("pre-filled value");
    });

    it("sets placeholder on input", () => {
      const modal = createModal("Label:", "Enter here");
      modal.onOpen();

      const input = modal.contentEl.querySelector("input") as HTMLInputElement;
      expect(input.placeholder).toBe("Enter here");
    });
  });

  describe("prompt()", () => {
    it("resolves with the entered value when OK is clicked", async () => {
      const modal = createModal("Name:");
      modal.onOpen();

      const input = modal.contentEl.querySelector("input") as HTMLInputElement;
      input.value = "My Value";

      const buttons = modal.contentEl.querySelectorAll("button");
      const okBtn = [...buttons].find((b) => b.textContent === "OK");
      expect(okBtn).not.toBeNull();

      const promise = modal.prompt();
      okBtn!.click();
      const result = await promise;
      expect(result).toBe("My Value");
    });

    it("resolves with null when Cancel is clicked", async () => {
      const modal = createModal("Name:");
      modal.onOpen();

      const buttons = modal.contentEl.querySelectorAll("button");
      const cancelBtn = [...buttons].find((b) => b.textContent === "Cancel");

      const promise = modal.prompt();
      cancelBtn!.click();
      const result = await promise;
      expect(result).toBeNull();
    });

    it("resolves with null when input is empty and OK is clicked", async () => {
      const modal = createModal("Name:");
      modal.onOpen();

      const input = modal.contentEl.querySelector("input") as HTMLInputElement;
      input.value = "  "; // whitespace only

      const buttons = modal.contentEl.querySelectorAll("button");
      const okBtn = [...buttons].find((b) => b.textContent === "OK");

      const promise = modal.prompt();
      okBtn!.click();
      const result = await promise;
      expect(result).toBeNull();
    });

    it("resolves with null when onClose is called without submission", async () => {
      const modal = createModal("Name:");
      modal.onOpen();

      const promise = modal.prompt();
      modal.onClose();
      const result = await promise;
      expect(result).toBeNull();
    });
  });

  describe("keyboard events", () => {
    it("submits when Enter key is pressed", async () => {
      const modal = createModal("Name:");
      modal.onOpen();

      const input = modal.contentEl.querySelector("input") as HTMLInputElement;
      input.value = "Keyboard Value";

      const promise = modal.prompt();
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      const result = await promise;
      expect(result).toBe("Keyboard Value");
    });

    it("cancels when Escape key is pressed", async () => {
      const modal = createModal("Name:");
      modal.onOpen();

      const input = modal.contentEl.querySelector("input") as HTMLInputElement;
      input.value = "Some Value";

      const promise = modal.prompt();
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      const result = await promise;
      expect(result).toBeNull();
    });
  });
});
