import { describe, it, expect } from "vitest";
import { ReferenceCreationModal } from "@/ui/modals/reference-creation-modal";
import { App } from "../mocks/obsidian-mock";

function makePage(name: string) {
  return { file: { name } } as unknown as import("@/types").DataviewPage;
}

function createModal(opts: {
  topics?: ReturnType<typeof makePage>[];
  clients?: ReturnType<typeof makePage>[];
  engagements?: ReturnType<typeof makePage>[];
  preselectedTopics?: string[];
  preselectedClient?: string;
  preselectedEngagement?: string;
} = {}) {
  const app = new App();
  return new ReferenceCreationModal(
    app as unknown as import("obsidian").App,
    opts.topics ?? [],
    opts.clients ?? [],
    opts.engagements ?? [],
    opts.preselectedTopics ?? [],
    opts.preselectedClient,
    opts.preselectedEngagement
  );
}

describe("ReferenceCreationModal", () => {
  describe("onOpen()", () => {
    it("renders name input", () => {
      const modal = createModal();
      modal.onOpen();
      const input = modal.contentEl.querySelector("input[type='text']");
      expect(input).not.toBeNull();
    });

    it("renders a checkbox for each topic", () => {
      const modal = createModal({
        topics: [makePage("Architecture"), makePage("Security")],
      });
      modal.onOpen();
      const checkboxes = modal.contentEl.querySelectorAll("input[type='checkbox']");
      expect(checkboxes.length).toBe(2);
    });

    it("renders client select with (None) plus provided clients", () => {
      const modal = createModal({
        clients: [makePage("Acme Corp"), makePage("Beta Inc")],
      });
      modal.onOpen();
      const selects = modal.contentEl.querySelectorAll("select");
      const clientSelect = selects[0]; // first select is client
      const options = Array.from(clientSelect.options).map((o) => o.value);
      expect(options[0]).toBe("");
      expect(options).toContain("Acme Corp");
      expect(options).toContain("Beta Inc");
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

    it("pre-checks topics matching preselectedTopics", () => {
      const modal = createModal({
        topics: [makePage("Architecture"), makePage("Security")],
        preselectedTopics: ["[[Architecture]]"],
      });
      modal.onOpen();
      const checkboxes = Array.from(
        modal.contentEl.querySelectorAll("input[type='checkbox']")
      ) as HTMLInputElement[];
      expect(checkboxes[0].checked).toBe(true);  // Architecture — preselected
      expect(checkboxes[1].checked).toBe(false); // Security — not preselected
    });

    it("pre-selects client when preselectedClient is provided", () => {
      const modal = createModal({
        clients: [makePage("Acme Corp")],
        preselectedClient: "Acme Corp",
      });
      modal.onOpen();
      const selects = modal.contentEl.querySelectorAll("select");
      expect((selects[0] as HTMLSelectElement).value).toBe("Acme Corp");
    });

    it("pre-selects engagement when preselectedEngagement is provided", () => {
      const modal = createModal({
        engagements: [makePage("Acme Audit")],
        preselectedEngagement: "Acme Audit",
      });
      modal.onOpen();
      const selects = modal.contentEl.querySelectorAll("select");
      expect((selects[1] as HTMLSelectElement).value).toBe("Acme Audit");
    });
  });

  describe("prompt() / submit / cancel", () => {
    it("resolves with result when name and at least one topic are provided", async () => {
      const modal = createModal({ topics: [makePage("Architecture")] });
      const promise = modal.prompt();
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "Clean Architecture";

      const checkbox = modal.contentEl.querySelector("input[type='checkbox']") as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change"));

      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      const result = await promise;
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Clean Architecture");
      expect(result?.topics).toEqual(["[[Architecture]]"]);
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
      const modal = createModal({ topics: [makePage("Architecture")] });
      let resolved = false;
      modal.prompt().then(() => { resolved = true; });
      modal.onOpen();

      // Check a topic but leave name empty
      const checkbox = modal.contentEl.querySelector("input[type='checkbox']") as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change"));

      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      await new Promise((r) => setTimeout(r, 10));
      expect(resolved).toBe(false);

      // Clean up
      modal.onClose();
    });

    it("does not resolve when Create is clicked with no topics checked", async () => {
      const modal = createModal({ topics: [makePage("Architecture")] });
      let resolved = false;
      modal.prompt().then(() => { resolved = true; });
      modal.onOpen();

      // Fill name but leave all checkboxes unchecked
      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "Some Reference";

      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      await new Promise((r) => setTimeout(r, 10));
      expect(resolved).toBe(false);

      // Clean up
      modal.onClose();
    });

    it("includes clientName and engagementName in result when selected", async () => {
      const modal = createModal({
        topics: [makePage("Architecture")],
        clients: [makePage("Acme Corp")],
        engagements: [makePage("Acme Audit")],
      });
      const promise = modal.prompt();
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "CQRS Pattern";

      const checkbox = modal.contentEl.querySelector("input[type='checkbox']") as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change"));

      const selects = modal.contentEl.querySelectorAll("select");
      (selects[0] as HTMLSelectElement).value = "Acme Corp";
      (selects[1] as HTMLSelectElement).value = "Acme Audit";

      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      const result = await promise;
      expect(result?.clientName).toBe("Acme Corp");
      expect(result?.engagementName).toBe("Acme Audit");
    });

    it("clientName and engagementName are undefined when (None) is selected", async () => {
      const modal = createModal({
        topics: [makePage("Architecture")],
        clients: [makePage("Acme Corp")],
        engagements: [makePage("Acme Audit")],
      });
      const promise = modal.prompt();
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "Design Patterns";

      const checkbox = modal.contentEl.querySelector("input[type='checkbox']") as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change"));

      // Leave selects at default (None)
      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      const result = await promise;
      expect(result?.clientName).toBeUndefined();
      expect(result?.engagementName).toBeUndefined();
    });

    it("preselected topics are included in result without manual checkbox interaction", async () => {
      const modal = createModal({
        topics: [makePage("Architecture"), makePage("Security")],
        preselectedTopics: ["[[Architecture]]"],
      });
      const promise = modal.prompt();
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "Pre-filled Reference";

      // No manual checkbox interaction — Architecture is pre-checked via constructor
      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      const result = await promise;
      expect(result?.topics).toContain("[[Architecture]]");
    });
  });
});
