import { describe, it, expect, afterEach } from "vitest";
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

/** Focus the topics input inside the FilterChipSelect to open suggestions. */
function focusTopicsInput(modal: ReferenceCreationModal): HTMLInputElement {
  const input = modal.contentEl.querySelector(
    ".pm-filter-chip-select .pm-autocomplete__input"
  ) as HTMLInputElement;
  input.dispatchEvent(new FocusEvent("focus"));
  return input;
}

/** Get the suggest input by aria-label. */
function getSuggestInput(modal: ReferenceCreationModal, ariaLabel: string): HTMLInputElement {
  return modal.contentEl.querySelector(`[aria-label="${ariaLabel}"]`) as HTMLInputElement;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ReferenceCreationModal", () => {
  describe("onOpen() — rendering", () => {
    it("renders name input", () => {
      const modal = createModal();
      modal.onOpen();
      const input = modal.contentEl.querySelector("input[type='text']");
      expect(input).not.toBeNull();
    });

    it("renders FilterChipSelect container for topics", () => {
      const modal = createModal({
        topics: [makePage("Architecture"), makePage("Security")],
      });
      modal.onOpen();
      expect(modal.contentEl.querySelector(".pm-filter-chip-select")).not.toBeNull();
    });

    it("renders topics suggest input with aria-label 'Topics'", () => {
      const modal = createModal({ topics: [makePage("Architecture")] });
      modal.onOpen();
      const input = getSuggestInput(modal, "Topics");
      expect(input).not.toBeNull();
    });

    it("renders client suggest input with aria-label 'Client'", () => {
      const modal = createModal({ clients: [makePage("Acme Corp")] });
      modal.onOpen();
      expect(getSuggestInput(modal, "Client")).not.toBeNull();
    });

    it("renders engagement suggest input with aria-label 'Engagement'", () => {
      const modal = createModal({ engagements: [makePage("Acme Audit")] });
      modal.onOpen();
      expect(getSuggestInput(modal, "Engagement")).not.toBeNull();
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

    it("does not render any checkboxes for topics", () => {
      const modal = createModal({
        topics: [makePage("Architecture"), makePage("Security")],
      });
      modal.onOpen();
      const checkboxes = modal.contentEl.querySelectorAll("input[type='checkbox']");
      expect(checkboxes.length).toBe(0);
    });

    it("does not render any <select> elements", () => {
      const modal = createModal({
        clients: [makePage("Acme Corp")],
        engagements: [makePage("Acme Audit")],
      });
      modal.onOpen();
      expect(modal.contentEl.querySelectorAll("select").length).toBe(0);
    });
  });

  describe("onOpen() — topics suggest", () => {
    it("opens topic suggestions on input focus", () => {
      const modal = createModal({ topics: [makePage("Architecture")] });
      modal.onOpen();
      focusTopicsInput(modal);
      const chipSelectEl = modal.contentEl.querySelector(".pm-filter-chip-select")!;
      expect(chipSelectEl.querySelector(".suggestion-container")).not.toBeNull();
    });

    it("topic options include all topics", () => {
      const modal = createModal({
        topics: [makePage("Architecture"), makePage("Security")],
      });
      modal.onOpen();
      focusTopicsInput(modal);
      const chipSelectEl = modal.contentEl.querySelector(".pm-filter-chip-select")!;
      const options = chipSelectEl.querySelectorAll(
        ".pm-autocomplete__option:not(.pm-autocomplete__option--none)"
      );
      expect(options.length).toBe(2);
    });

    it("does not show (None) option in topic suggest", () => {
      const modal = createModal({ topics: [makePage("Architecture")] });
      modal.onOpen();
      focusTopicsInput(modal);
      const chipSelectEl = modal.contentEl.querySelector(".pm-filter-chip-select")!;
      expect(chipSelectEl.querySelector(".pm-autocomplete__option--none")).toBeNull();
    });

    it("selecting a topic adds a chip", () => {
      const modal = createModal({ topics: [makePage("Architecture")] });
      modal.onOpen();
      focusTopicsInput(modal);
      const chipSelectEl = modal.contentEl.querySelector(".pm-filter-chip-select")!;
      const option = chipSelectEl.querySelector(".pm-autocomplete__option") as HTMLElement;
      option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      expect(modal.contentEl.querySelectorAll(".pm-filter-chip-select__chip").length).toBe(1);
    });

    it("chip displays topic display name (not wikilink value)", () => {
      const modal = createModal({ topics: [makePage("Architecture")] });
      modal.onOpen();
      focusTopicsInput(modal);
      const chipSelectEl = modal.contentEl.querySelector(".pm-filter-chip-select")!;
      const option = chipSelectEl.querySelector(".pm-autocomplete__option") as HTMLElement;
      option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      const chip = modal.contentEl.querySelector(".pm-filter-chip-select__chip");
      expect(chip?.textContent).toContain("Architecture");
      expect(chip?.textContent).not.toContain("[[");
    });

    it("removing a chip via × button removes it from the display", () => {
      const modal = createModal({ topics: [makePage("Architecture")] });
      modal.onOpen();
      focusTopicsInput(modal);
      const chipSelectEl = modal.contentEl.querySelector(".pm-filter-chip-select")!;
      const option = chipSelectEl.querySelector(".pm-autocomplete__option") as HTMLElement;
      option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      const removeBtn = modal.contentEl.querySelector(
        ".pm-filter-chip-select__chip-remove"
      ) as HTMLElement;
      removeBtn.click();

      expect(modal.contentEl.querySelectorAll(".pm-filter-chip-select__chip").length).toBe(0);
    });

    it("topic filtering narrows suggestions by substring", () => {
      const modal = createModal({
        topics: [makePage("Architecture"), makePage("Security"), makePage("Archiving")],
      });
      modal.onOpen();
      const topicsInput = focusTopicsInput(modal);
      topicsInput.value = "arch";
      topicsInput.dispatchEvent(new Event("input"));

      const chipSelectEl = modal.contentEl.querySelector(".pm-filter-chip-select")!;
      const options = chipSelectEl.querySelectorAll(
        ".pm-autocomplete__option:not(.pm-autocomplete__option--none)"
      );
      // "Architecture" and "Archiving" match; "Security" does not
      expect(options.length).toBe(2);
    });
  });

  describe("onOpen() — pre-selected topics", () => {
    it("pre-selected topics appear as chips on open", () => {
      const modal = createModal({
        topics: [makePage("Architecture"), makePage("Security")],
        preselectedTopics: ["[[Architecture]]"],
      });
      modal.onOpen();
      const chips = modal.contentEl.querySelectorAll(".pm-filter-chip-select__chip");
      expect(chips.length).toBe(1);
      expect(chips[0].textContent).toContain("Architecture");
    });

    it("non-preselected topics do not appear as chips", () => {
      const modal = createModal({
        topics: [makePage("Architecture"), makePage("Security")],
        preselectedTopics: ["[[Architecture]]"],
      });
      modal.onOpen();
      const chips = Array.from(modal.contentEl.querySelectorAll(".pm-filter-chip-select__chip"));
      const hasSecurityChip = chips.some((c) => c.textContent?.includes("Security"));
      expect(hasSecurityChip).toBe(false);
    });
  });

  describe("onOpen() — client suggest pre-selection", () => {
    it("pre-selected client value appears in the client input", () => {
      const modal = createModal({
        clients: [makePage("Acme Corp")],
        preselectedClient: "Acme Corp",
      });
      modal.onOpen();
      const clientInput = getSuggestInput(modal, "Client");
      expect(clientInput.value).toBe("Acme Corp");
    });

    it("client input is empty when no preselectedClient", () => {
      const modal = createModal({ clients: [makePage("Acme Corp")] });
      modal.onOpen();
      const clientInput = getSuggestInput(modal, "Client");
      expect(clientInput.value).toBe("");
    });
  });

  describe("onOpen() — engagement suggest pre-selection", () => {
    it("pre-selected engagement value appears in the engagement input", () => {
      const modal = createModal({
        engagements: [makePage("Acme Audit")],
        preselectedEngagement: "Acme Audit",
      });
      modal.onOpen();
      const engInput = getSuggestInput(modal, "Engagement");
      expect(engInput.value).toBe("Acme Audit");
    });

    it("engagement input is empty when no preselectedEngagement", () => {
      const modal = createModal({ engagements: [makePage("Acme Audit")] });
      modal.onOpen();
      const engInput = getSuggestInput(modal, "Engagement");
      expect(engInput.value).toBe("");
    });
  });

  describe("prompt() / submit / cancel", () => {
    it("resolves with result when name and at least one topic chip are present", async () => {
      const modal = createModal({ topics: [makePage("Architecture")] });
      const promise = modal.prompt();
      modal.onOpen();

      // Fill name
      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "Clean Architecture";

      // Select topic via chip select
      focusTopicsInput(modal);
      const chipSelectEl = modal.contentEl.querySelector(".pm-filter-chip-select")!;
      const option = chipSelectEl.querySelector(".pm-autocomplete__option") as HTMLElement;
      option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

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

      // Select topic but leave name empty
      focusTopicsInput(modal);
      const chipSelectEl = modal.contentEl.querySelector(".pm-filter-chip-select")!;
      const option = chipSelectEl.querySelector(".pm-autocomplete__option") as HTMLElement;
      option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      await new Promise((r) => setTimeout(r, 10));
      expect(resolved).toBe(false);

      modal.onClose();
    });

    it("does not resolve when Create is clicked with no topics selected", async () => {
      const modal = createModal({ topics: [makePage("Architecture")] });
      let resolved = false;
      modal.prompt().then(() => { resolved = true; });
      modal.onOpen();

      // Fill name but select no topics
      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "Some Reference";

      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      await new Promise((r) => setTimeout(r, 10));
      expect(resolved).toBe(false);

      modal.onClose();
    });

    it("includes clientName in result when selected via suggest", async () => {
      const modal = createModal({
        topics: [makePage("Architecture")],
        clients: [makePage("Acme Corp")],
      });
      const promise = modal.prompt();
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "CQRS Pattern";

      // Select topic
      focusTopicsInput(modal);
      const chipSelectEl = modal.contentEl.querySelector(".pm-filter-chip-select")!;
      const topicOption = chipSelectEl.querySelector(".pm-autocomplete__option") as HTMLElement;
      topicOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      // Select client via suggest
      const clientInput = getSuggestInput(modal, "Client");
      clientInput.dispatchEvent(new FocusEvent("focus"));
      const clientContainer = clientInput.parentElement!;
      const clientOption = Array.from(
        clientContainer.querySelectorAll(".pm-autocomplete__option:not(.pm-autocomplete__option--none)")
      ).find((el) => el.textContent === "Acme Corp") as HTMLElement;
      clientOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      const result = await promise;
      expect(result?.clientName).toBe("Acme Corp");
    });

    it("includes engagementName in result when selected via suggest", async () => {
      const modal = createModal({
        topics: [makePage("Architecture")],
        engagements: [makePage("Acme Audit")],
      });
      const promise = modal.prompt();
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "CQRS Pattern";

      // Select topic
      focusTopicsInput(modal);
      const chipSelectEl = modal.contentEl.querySelector(".pm-filter-chip-select")!;
      const topicOption = chipSelectEl.querySelector(".pm-autocomplete__option") as HTMLElement;
      topicOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      // Select engagement via suggest
      const engInput = getSuggestInput(modal, "Engagement");
      engInput.dispatchEvent(new FocusEvent("focus"));
      const engContainer = engInput.parentElement!;
      const engOption = Array.from(
        engContainer.querySelectorAll(".pm-autocomplete__option:not(.pm-autocomplete__option--none)")
      ).find((el) => el.textContent === "Acme Audit") as HTMLElement;
      engOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      const result = await promise;
      expect(result?.engagementName).toBe("Acme Audit");
    });

    it("clientName is undefined when (None) is selected after a client was chosen", async () => {
      const modal = createModal({
        topics: [makePage("Architecture")],
        clients: [makePage("Acme Corp")],
        preselectedClient: "Acme Corp",
      });
      const promise = modal.prompt();
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "Design Patterns";

      // Select topic
      focusTopicsInput(modal);
      const chipSelectEl = modal.contentEl.querySelector(".pm-filter-chip-select")!;
      const topicOption = chipSelectEl.querySelector(".pm-autocomplete__option") as HTMLElement;
      topicOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      // Clear client by selecting (None)
      const clientInput = getSuggestInput(modal, "Client");
      clientInput.dispatchEvent(new FocusEvent("focus"));
      const clientContainer = clientInput.parentElement!;
      const noneOption = clientContainer.querySelector(
        ".pm-autocomplete__option--none"
      ) as HTMLElement;
      noneOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      const result = await promise;
      expect(result?.clientName).toBeUndefined();
    });

    it("engagementName is undefined when (None) is selected after an engagement was chosen", async () => {
      const modal = createModal({
        topics: [makePage("Architecture")],
        engagements: [makePage("Acme Audit")],
        preselectedEngagement: "Acme Audit",
      });
      const promise = modal.prompt();
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "Design Patterns";

      // Select topic
      focusTopicsInput(modal);
      const chipSelectEl = modal.contentEl.querySelector(".pm-filter-chip-select")!;
      const topicOption = chipSelectEl.querySelector(".pm-autocomplete__option") as HTMLElement;
      topicOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      // Clear engagement by selecting (None)
      const engInput = getSuggestInput(modal, "Engagement");
      engInput.dispatchEvent(new FocusEvent("focus"));
      const engContainer = engInput.parentElement!;
      const noneOption = engContainer.querySelector(
        ".pm-autocomplete__option--none"
      ) as HTMLElement;
      noneOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      const result = await promise;
      expect(result?.engagementName).toBeUndefined();
    });

    it("clientName and engagementName are undefined when no selection is made", async () => {
      const modal = createModal({
        topics: [makePage("Architecture")],
        clients: [makePage("Acme Corp")],
        engagements: [makePage("Acme Audit")],
      });
      const promise = modal.prompt();
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "Design Patterns";

      // Select topic only
      focusTopicsInput(modal);
      const chipSelectEl = modal.contentEl.querySelector(".pm-filter-chip-select")!;
      const topicOption = chipSelectEl.querySelector(".pm-autocomplete__option") as HTMLElement;
      topicOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      const result = await promise;
      expect(result?.clientName).toBeUndefined();
      expect(result?.engagementName).toBeUndefined();
    });

    it("preselected topics are included in result without manual chip interaction", async () => {
      const modal = createModal({
        topics: [makePage("Architecture"), makePage("Security")],
        preselectedTopics: ["[[Architecture]]"],
      });
      const promise = modal.prompt();
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "Pre-filled Reference";

      // No chip interaction — Architecture is pre-selected via constructor
      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      const result = await promise;
      expect(result?.topics).toContain("[[Architecture]]");
    });

    it("topics result contains wikilink strings", async () => {
      const modal = createModal({ topics: [makePage("Architecture")] });
      const promise = modal.prompt();
      modal.onOpen();

      const input = modal.contentEl.querySelector("input[type='text']") as HTMLInputElement;
      input.value = "Test Reference";

      focusTopicsInput(modal);
      const chipSelectEl = modal.contentEl.querySelector(".pm-filter-chip-select")!;
      const option = chipSelectEl.querySelector(".pm-autocomplete__option") as HTMLElement;
      option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      const createBtn = Array.from(modal.contentEl.querySelectorAll("button")).find(
        (b) => b.textContent === "Create"
      ) as HTMLButtonElement;
      createBtn.click();

      const result = await promise;
      expect(result?.topics[0]).toBe("[[Architecture]]");
    });
  });
});
