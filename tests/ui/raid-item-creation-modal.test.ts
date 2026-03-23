import { describe, it, expect } from "vitest";
import { RaidItemCreationModal } from "@/ui/modals/raid-item-creation-modal";
import { App } from "../mocks/obsidian-mock";

function makePage(name: string) {
  return { file: { name } } as unknown as import("@/types").DataviewPage;
}

function createModal(opts: {
  engagements?: ReturnType<typeof makePage>[];
  owners?: ReturnType<typeof makePage>[];
} = {}) {
  const app = new App();
  return new RaidItemCreationModal(
    app as unknown as import("obsidian").App,
    opts.engagements ?? [],
    opts.owners ?? []
  );
}

describe("RaidItemCreationModal", () => {
  describe("onOpen()", () => {
    it("renders name input", () => {
      const modal = createModal();
      modal.onOpen();
      const input = modal.contentEl.querySelector("input[type='text']");
      expect(input).not.toBeNull();
    });

    it("renders RAID type select with all four options", () => {
      const modal = createModal();
      modal.onOpen();
      const selects = modal.contentEl.querySelectorAll("select");
      // First select is RAID type
      expect(selects.length).toBeGreaterThanOrEqual(1);
      const typeSelect = selects[0];
      const options = Array.from(typeSelect.options).map((o) => o.value);
      expect(options).toEqual(["Risk", "Assumption", "Issue", "Decision"]);
    });

    it("renders engagement select with (None) plus provided engagements", () => {
      const modal = createModal({
        engagements: [makePage("Acme Audit"), makePage("Beta Review")],
      });
      modal.onOpen();
      const selects = modal.contentEl.querySelectorAll("select");
      const engSelect = selects[1]; // second select is engagement
      const options = Array.from(engSelect.options).map((o) => o.value);
      expect(options[0]).toBe("");
      expect(options).toContain("Acme Audit");
      expect(options).toContain("Beta Review");
    });

    it("renders owner select with (None) plus provided owners", () => {
      const modal = createModal({
        owners: [makePage("Alice Smith"), makePage("Bob Jones")],
      });
      modal.onOpen();
      const selects = modal.contentEl.querySelectorAll("select");
      const ownerSelect = selects[2]; // third select is owner
      const options = Array.from(ownerSelect.options).map((o) => o.value);
      expect(options[0]).toBe("");
      expect(options).toContain("Alice Smith");
      expect(options).toContain("Bob Jones");
    });

    it("renders Cancel and Create buttons", () => {
      const modal = createModal();
      modal.onOpen();
      const buttons = modal.contentEl.querySelectorAll("button");
      const labels = Array.from(buttons).map((b) => b.textContent);
      expect(labels).toContain("Cancel");
      expect(labels).toContain("Create");
    });

    it("Create button has mod-cta class", () => {
      const modal = createModal();
      modal.onOpen();
      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      );
      expect(createBtn?.classList.contains("mod-cta")).toBe(true);
    });
  });

  describe("prompt() / submit / cancel", () => {
    it("resolves with result when name is filled and Create is clicked", async () => {
      const modal = createModal({ engagements: [makePage("Acme Audit")] });
      const promise = modal.prompt();
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "Supply Chain Risk";

      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      const result = await promise;
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Supply Chain Risk");
      expect(result?.raidType).toBe("Risk"); // default first option
    });

    it("resolves with null when Cancel is clicked", async () => {
      const modal = createModal();
      const promise = modal.prompt();
      modal.onOpen();

      const cancelBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Cancel"
      ) as HTMLButtonElement;
      cancelBtn.click();

      const result = await promise;
      expect(result).toBeNull();
    });

    it("resolves with null when onClose() fires without submission", async () => {
      const modal = createModal();
      const promise = modal.prompt();
      modal.onOpen();
      modal.onClose();

      const result = await promise;
      expect(result).toBeNull();
    });

    it("does not resolve when Create is clicked with empty name", async () => {
      const modal = createModal();
      let resolved = false;
      modal.prompt().then(() => { resolved = true; });
      modal.onOpen();

      // Name is empty — Create should not resolve
      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      await new Promise((r) => setTimeout(r, 10));
      expect(resolved).toBe(false);

      // Clean up
      modal.onClose();
    });

    it("includes engagementName and ownerName in result when selected", async () => {
      const modal = createModal({
        engagements: [makePage("Acme Audit")],
        owners: [makePage("Alice Smith")],
      });
      const promise = modal.prompt();
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "Budget Risk";

      const selects = modal.contentEl.querySelectorAll("select");
      (selects[0] as HTMLSelectElement).value = "Issue";
      (selects[1] as HTMLSelectElement).value = "Acme Audit";
      (selects[2] as HTMLSelectElement).value = "Alice Smith";

      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      const result = await promise;
      expect(result?.raidType).toBe("Issue");
      expect(result?.engagementName).toBe("Acme Audit");
      expect(result?.ownerName).toBe("Alice Smith");
    });

    it("engagementName and ownerName are undefined when (None) is selected", async () => {
      const modal = createModal({
        engagements: [makePage("Acme Audit")],
        owners: [makePage("Alice Smith")],
      });
      const promise = modal.prompt();
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "Scope Risk";

      // Leave selects at default "(None)"
      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      const result = await promise;
      expect(result?.engagementName).toBeUndefined();
      expect(result?.ownerName).toBeUndefined();
    });
  });
});
