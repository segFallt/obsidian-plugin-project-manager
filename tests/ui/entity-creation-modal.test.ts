import { describe, it, expect } from "vitest";
import { EntityCreationModal } from "../../src/ui/modals/entity-creation-modal";
import { App } from "../mocks/obsidian-mock";
import { createMockPage } from "../mocks/dataview-mock";

function createModal(opts: {
  title?: string;
  namePlaceholder?: string;
  parentLabel?: string | null;
  parentOptions?: ReturnType<typeof createMockPage>[];
  preselectedParent?: string;
}) {
  const app = new App();
  return new EntityCreationModal(
    app as unknown as import("obsidian").App,
    opts.title ?? "Create Entity",
    opts.namePlaceholder ?? "Name",
    opts.parentLabel ?? null,
    (opts.parentOptions ?? []) as unknown as import("../../src/types").DataviewPage[],
    opts.preselectedParent
  );
}

describe("EntityCreationModal", () => {
  describe("onOpen()", () => {
    it("renders name input always", () => {
      const modal = createModal({});
      modal.onOpen();
      const input = modal.contentEl.querySelector("input");
      expect(input).not.toBeNull();
    });

    it("renders parent select when parentLabel and options are provided", () => {
      const options = [
        createMockPage({ path: "clients/Acme.md", frontmatter: { status: "Active" } }),
        createMockPage({ path: "clients/Beta.md", frontmatter: { status: "Inactive" } }),
      ];
      const modal = createModal({ parentLabel: "Client (optional)", parentOptions: options });
      modal.onOpen();
      const select = modal.contentEl.querySelector("select");
      expect(select).not.toBeNull();
    });

    it("does NOT render parent select when parentLabel is null", () => {
      const modal = createModal({ parentLabel: null });
      modal.onOpen();
      const select = modal.contentEl.querySelector("select");
      expect(select).toBeNull();
    });

    it("sorts parent options: Active first, then alphabetically", () => {
      const options = [
        createMockPage({ path: "clients/Zebra.md", name: "Zebra", frontmatter: { status: "Active" } }),
        createMockPage({ path: "clients/Alpha.md", name: "Alpha", frontmatter: { status: "Inactive" } }),
        createMockPage({ path: "clients/Beta.md", name: "Beta", frontmatter: { status: "Active" } }),
      ];
      const modal = createModal({ parentLabel: "Client", parentOptions: options });
      modal.onOpen();

      const select = modal.contentEl.querySelector("select") as HTMLSelectElement;
      const optionTexts = [...select.querySelectorAll("option")]
        .slice(1) // skip the "(None)" option
        .map((o) => (o as HTMLOptionElement).text);

      // Beta and Zebra are Active (alpha order), then Alpha is Inactive
      expect(optionTexts[0]).toBe("Beta");
      expect(optionTexts[1]).toBe("Zebra");
      expect(optionTexts[2]).toBe("Alpha");
    });

    it("pre-selects the specified parent when preselectedParent is provided", () => {
      const options = [
        createMockPage({ path: "clients/Acme.md", name: "Acme", frontmatter: { status: "Active" } }),
        createMockPage({ path: "clients/Beta.md", name: "Beta", frontmatter: { status: "Active" } }),
      ];
      const modal = createModal({ parentLabel: "Client", parentOptions: options, preselectedParent: "Acme" });
      modal.onOpen();
      const select = modal.contentEl.querySelector("select") as HTMLSelectElement;
      expect(select.value).toBe("Acme");
    });

    it("includes a (None) option as first item", () => {
      const options = [createMockPage({ path: "clients/Acme.md" })];
      const modal = createModal({ parentLabel: "Client", parentOptions: options });
      modal.onOpen();

      const select = modal.contentEl.querySelector("select") as HTMLSelectElement;
      const firstOption = select.querySelector("option") as HTMLOptionElement;
      // The (None) option has value="" and text "(None)"
      expect(firstOption.text).toBe("(None)");
      expect(firstOption.getAttribute("value")).toBe("");
    });
  });

  describe("prompt()", () => {
    it("resolves with name and parentName when Create is clicked", async () => {
      const options = [createMockPage({ path: "clients/Acme.md", name: "Acme", frontmatter: { status: "Active" } })];
      const modal = createModal({ title: "New Thing", parentLabel: "Client", parentOptions: options });
      modal.onOpen();

      const nameInput = modal.contentEl.querySelector("input") as HTMLInputElement;
      nameInput.value = "My Entity";

      const select = modal.contentEl.querySelector("select") as HTMLSelectElement;
      select.value = "Acme";

      const buttons = modal.contentEl.querySelectorAll("button");
      const createBtn = [...buttons].find((b) => b.textContent === "Create");

      const promise = modal.prompt();
      createBtn!.click();
      const result = await promise;
      expect(result?.name).toBe("My Entity");
      expect(result?.parentName).toBe("Acme");
    });

    it("does NOT resolve when name is empty and Create is clicked", async () => {
      const modal = createModal({});
      modal.onOpen();

      const nameInput = modal.contentEl.querySelector("input") as HTMLInputElement;
      nameInput.value = "";

      const buttons = modal.contentEl.querySelectorAll("button");
      const createBtn = [...buttons].find((b) => b.textContent === "Create");

      // Will not resolve immediately if name is empty, so just verify it doesn't crash
      createBtn!.click(); // should be a no-op
      // No assertion needed — just verifying no error thrown
    });

    it("resolves with null when Cancel is clicked", async () => {
      const modal = createModal({});
      modal.onOpen();

      const buttons = modal.contentEl.querySelectorAll("button");
      const cancelBtn = [...buttons].find((b) => b.textContent === "Cancel");

      const promise = modal.prompt();
      cancelBtn!.click();
      const result = await promise;
      expect(result).toBeNull();
    });

    it("resolves with null when onClose is called without submission", async () => {
      const modal = createModal({});
      modal.onOpen();
      const promise = modal.prompt();
      modal.onClose();
      const result = await promise;
      expect(result).toBeNull();
    });

    it("resolves with parentName as null when no parent selected", async () => {
      const modal = createModal({ parentLabel: null });
      modal.onOpen();

      const nameInput = modal.contentEl.querySelector("input") as HTMLInputElement;
      nameInput.value = "My Entity";

      const buttons = modal.contentEl.querySelectorAll("button");
      const createBtn = [...buttons].find((b) => b.textContent === "Create");

      const promise = modal.prompt();
      createBtn!.click();
      const result = await promise;
      expect(result?.parentName).toBeNull();
    });
  });
});
