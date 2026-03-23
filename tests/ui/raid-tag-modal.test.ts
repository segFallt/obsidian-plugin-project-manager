import { describe, it, expect } from "vitest";
import { RaidTagModal } from "@/ui/modals/raid-tag-modal";
import { App } from "../mocks/obsidian-mock";

function makePage(name: string, raidType: string, engagement?: string) {
  return {
    file: { name, path: `raid/${name}.md` },
    "raid-type": raidType,
    engagement,
  } as unknown as import("@/types").DataviewPage;
}

function makeItem(name: string, raidType: string, label?: string) {
  return { page: makePage(name, raidType), label: label ?? `[${raidType[0]}] ${name}` };
}

function createModal(items: ReturnType<typeof makeItem>[] = []) {
  const app = new App();
  return new RaidTagModal(app as unknown as import("obsidian").App, items);
}

describe("RaidTagModal", () => {
  describe("onOpen()", () => {
    it("renders RAID item select with one option per item", () => {
      const modal = createModal([
        makeItem("Scope Creep", "Risk"),
        makeItem("Budget Overrun", "Issue"),
      ]);
      modal.onOpen();
      const selects = modal.contentEl.querySelectorAll("select");
      const itemSelect = selects[0];
      expect(itemSelect.options.length).toBe(2);
      expect(Array.from(itemSelect.options).map((o) => o.value)).toEqual([
        "Scope Creep",
        "Budget Overrun",
      ]);
    });

    it("renders direction select with 3 options for the first item's RAID type", () => {
      const modal = createModal([makeItem("Scope Creep", "Risk")]);
      modal.onOpen();
      const selects = modal.contentEl.querySelectorAll("select");
      const dirSelect = selects[1];
      const values = Array.from(dirSelect.options).map((o) => o.value);
      expect(values).toEqual(["positive", "negative", "neutral"]);
    });

    it("direction option labels reflect the RAID type of the first item", () => {
      const modal = createModal([makeItem("Budget Overrun", "Issue")]);
      modal.onOpen();
      const selects = modal.contentEl.querySelectorAll("select");
      const dirSelect = selects[1];
      const labels = Array.from(dirSelect.options).map((o) => o.text);
      // Issue type: Resolves, Compounds, Notes
      expect(labels[0]).toContain("Resolves");
      expect(labels[1]).toContain("Compounds");
      expect(labels[2]).toContain("Notes");
    });

    it("direction labels update when RAID item selection changes", () => {
      const modal = createModal([
        makeItem("Risk Item", "Risk"),
        makeItem("Decision Item", "Decision"),
      ]);
      modal.onOpen();
      const selects = modal.contentEl.querySelectorAll("select");
      const itemSelect = selects[0] as HTMLSelectElement;
      const dirSelect = selects[1];

      // Change to Decision item
      itemSelect.value = "Decision Item";
      itemSelect.dispatchEvent(new Event("change"));

      const labels = Array.from(dirSelect.options).map((o) => o.text);
      // Decision type: Supports, Challenges, Notes
      expect(labels[0]).toContain("Supports");
      expect(labels[1]).toContain("Challenges");
    });

    it("renders Cancel and Tag Line buttons", () => {
      const modal = createModal([makeItem("Item", "Risk")]);
      modal.onOpen();
      const buttons = modal.contentEl.querySelectorAll("button");
      const labels = Array.from(buttons).map((b) => b.textContent);
      expect(labels).toContain("Cancel");
      expect(labels).toContain("Tag Line");
    });

    it("Tag Line button has mod-cta class", () => {
      const modal = createModal([makeItem("Item", "Risk")]);
      modal.onOpen();
      const tagBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Tag Line"
      );
      expect(tagBtn?.classList.contains("mod-cta")).toBe(true);
    });

    it("context items with ★ prefix appear in the select with their full label", () => {
      const modal = createModal([
        { page: makePage("Client Risk", "Risk"), label: "★ [R] Client Risk (Acme Audit)" },
        { page: makePage("General Risk", "Risk"), label: "[R] General Risk" },
      ]);
      modal.onOpen();
      const itemSelect = modal.contentEl.querySelectorAll("select")[0];
      const labels = Array.from(itemSelect.options).map((o) => o.text);
      expect(labels[0]).toContain("★");
      expect(labels[1]).not.toContain("★");
    });
  });

  describe("prompt() / submit / cancel", () => {
    it("resolves with itemName and direction when Tag Line is clicked", async () => {
      const modal = createModal([makeItem("Scope Creep", "Risk")]);
      const promise = modal.prompt();
      modal.onOpen();

      const tagBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Tag Line"
      ) as HTMLButtonElement;
      tagBtn.click();

      const result = await promise;
      expect(result).not.toBeNull();
      expect(result?.itemName).toBe("Scope Creep");
      expect(result?.direction).toBe("positive"); // default first option
    });

    it("resolves with the selected direction value", async () => {
      const modal = createModal([makeItem("Scope Creep", "Risk")]);
      const promise = modal.prompt();
      modal.onOpen();

      // Change direction to negative
      const dirSelect = modal.contentEl.querySelectorAll("select")[1] as HTMLSelectElement;
      dirSelect.value = "negative";

      const tagBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Tag Line"
      ) as HTMLButtonElement;
      tagBtn.click();

      const result = await promise;
      expect(result?.direction).toBe("negative");
    });

    it("resolves with null when Cancel is clicked", async () => {
      const modal = createModal([makeItem("Item", "Risk")]);
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
      const modal = createModal([makeItem("Item", "Risk")]);
      const promise = modal.prompt();
      modal.onOpen();
      modal.onClose();

      const result = await promise;
      expect(result).toBeNull();
    });

    it("resolves with the selected RAID item when a different item is chosen", async () => {
      const modal = createModal([
        makeItem("Scope Creep", "Risk"),
        makeItem("Budget Overrun", "Issue"),
      ]);
      const promise = modal.prompt();
      modal.onOpen();

      const itemSelect = modal.contentEl.querySelectorAll("select")[0] as HTMLSelectElement;
      itemSelect.value = "Budget Overrun";
      itemSelect.dispatchEvent(new Event("change"));

      const tagBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Tag Line"
      ) as HTMLButtonElement;
      tagBtn.click();

      const result = await promise;
      expect(result?.itemName).toBe("Budget Overrun");
    });
  });
});
