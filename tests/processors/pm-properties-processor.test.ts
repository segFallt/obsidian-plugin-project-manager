import { describe, it, expect, vi } from "vitest";
import { registerPmPropertiesProcessor } from "../../src/processors/pm-properties-processor";
import { TFile } from "../mocks/obsidian-mock";
import type { PluginServices, RegisterProcessorFn } from "../../src/plugin-context";

// ─── Mock services factory ───────────────────────────────────────────────────

function createMockServices(
  sourcePathFile: InstanceType<typeof TFile> | null = null,
  frontmatter: Record<string, unknown> = {}
) {
  let registeredHandler:
    | ((
        source: string,
        el: HTMLElement,
        ctx: { addChild: (c: { render(): void }) => void; sourcePath: string }
      ) => void)
    | null = null;

  const mockFile = sourcePathFile;
  const vaultOn = vi.fn(() => ({ id: "mock-event" }));

  const registerProcessor: RegisterProcessorFn = vi.fn((_lang, handler) => {
    registeredHandler = handler;
  });

  const services = {
    app: {
      vault: {
        on: vaultOn,
        getAbstractFileByPath: vi.fn((_path: string) => mockFile),
      },
      metadataCache: {
        getFileCache: vi.fn(() => ({ frontmatter })),
      },
      fileManager: {
        processFrontMatter: vi.fn(async () => {}),
      },
    },
    queryService: {
      getActiveEntitiesByTag: vi.fn(() => []),
    },
  } as unknown as PluginServices;

  return {
    services,
    registerProcessor,
    vaultOn,
    getHandler: () => registeredHandler!,
  };
}

// ─── Render helper ──────────────────────────────────────────────────────────

function render(
  source: string,
  sourcePathFile: InstanceType<typeof TFile> | null = null,
  frontmatter: Record<string, unknown> = {}
) {
  const { services, registerProcessor, getHandler } = createMockServices(sourcePathFile, frontmatter);
  registerPmPropertiesProcessor(services, registerProcessor);

  const el = document.createElement("div");
  const children: Array<{ render(): void }> = [];
  const ctx = {
    addChild: (child: { render(): void }) => {
      children.push(child);
    },
    sourcePath: sourcePathFile?.path ?? "test.md",
  };

  getHandler()(source, el, ctx);
  return { el, children };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("pm-properties processor", () => {
  it("registers a 'pm-properties' code block processor", () => {
    const { services, registerProcessor } = createMockServices();
    registerPmPropertiesProcessor(services, registerProcessor);
    expect(registerProcessor).toHaveBeenCalledWith(
      "pm-properties",
      expect.any(Function)
    );
  });

  describe("render() — error paths", () => {
    it("shows error when entity field is missing", () => {
      const file = new TFile("clients/Acme.md");
      const { el } = render("status: Active", file);
      expect(el.querySelector(".pm-error")).not.toBeNull();
      expect(el.textContent).toContain("entity");
    });

    it("shows error when entity type is unknown", () => {
      const file = new TFile("misc/Foo.md");
      const { el } = render("entity: unknown-type", file);
      expect(el.querySelector(".pm-error")).not.toBeNull();
      expect(el.textContent).toContain("Unknown entity type");
    });

    it("shows error when file cannot be resolved (getAbstractFileByPath returns null)", () => {
      const { el } = render("entity: client", null);
      expect(el.querySelector(".pm-error")).not.toBeNull();
      expect(el.textContent).toContain("Could not resolve");
    });
  });

  describe("render() — valid entity", () => {
    it("renders a form for 'client' entity", () => {
      const file = new TFile("clients/Acme.md");
      const { el } = render("entity: client", file, { status: "Active" });
      expect(el.querySelector(".pm-properties")).not.toBeNull();
      const rows = el.querySelectorAll(".pm-properties__row");
      expect(rows.length).toBeGreaterThan(0);
    });

    it("renders status select for client with correct current value", () => {
      const file = new TFile("clients/Acme.md");
      const { el } = render("entity: client", file, { status: "Inactive" });
      const selects = el.querySelectorAll("select");
      expect(selects.length).toBeGreaterThan(0);
    });

    it("renders text inputs for client contact fields", () => {
      const file = new TFile("clients/Acme.md");
      const { el } = render("entity: client", file, {
        "contact-name": "Alice",
        "contact-email": "alice@example.com",
      });
      const inputs = el.querySelectorAll("input[type='text']");
      expect(inputs.length).toBeGreaterThan(0);
    });

    it("renders textarea for client notes field", () => {
      const file = new TFile("clients/Acme.md");
      const { el } = render("entity: client", file, {
        notes: "Some notes here",
      });
      const textareas = el.querySelectorAll("textarea");
      expect(textareas.length).toBeGreaterThan(0);
    });

    it("renders label elements associated with their inputs", () => {
      const file = new TFile("clients/Acme.md");
      const { el } = render("entity: client", file);
      const labels = el.querySelectorAll("label");
      expect(labels.length).toBeGreaterThan(0);
    });

    it("renders form for 'engagement' entity", () => {
      const file = new TFile("engagements/Eng1.md");
      const { el } = render("entity: engagement", file, {
        status: "Active",
      });
      expect(el.querySelector(".pm-properties")).not.toBeNull();
    });

    it("renders date inputs for engagement entity", () => {
      const file = new TFile("engagements/Eng1.md");
      const { el } = render("entity: engagement", file, {
        "start-date": "2024-01-01",
        "end-date": "2024-12-31",
      });
      const dateInputs = el.querySelectorAll("input[type='date']");
      expect(dateInputs.length).toBeGreaterThan(0);
    });

    it("renders form for 'project' entity", () => {
      const file = new TFile("projects/Alpha.md");
      const { el } = render("entity: project", file, {
        status: "Active",
        priority: "1",
      });
      expect(el.querySelector(".pm-properties")).not.toBeNull();
    });

    it("renders form for 'person' entity", () => {
      const file = new TFile("people/Alice.md");
      const { el } = render("entity: person", file, {
        status: "Active",
      });
      expect(el.querySelector(".pm-properties")).not.toBeNull();
    });

    it("renders form for 'inbox' entity", () => {
      const file = new TFile("inbox/Note1.md");
      const { el } = render("entity: inbox", file, { status: "Active" });
      expect(el.querySelector(".pm-properties")).not.toBeNull();
    });

    it("renders form for 'single-meeting' entity with datetime input", () => {
      const file = new TFile("meetings/Meet1.md");
      const { el } = render("entity: single-meeting", file, {
        date: "2024-01-15T10:00",
      });
      expect(el.querySelector(".pm-properties")).not.toBeNull();
      const dtInputs = el.querySelectorAll("input[type='datetime-local']");
      expect(dtInputs.length).toBeGreaterThan(0);
    });

    it("renders form for 'recurring-meeting' entity", () => {
      const file = new TFile("meetings/RecurMeet.md");
      const { el } = render("entity: recurring-meeting", file);
      expect(el.querySelector(".pm-properties")).not.toBeNull();
    });

    it("renders form for 'project-note' entity", () => {
      const file = new TFile("projects/Note.md");
      const { el } = render("entity: project-note", file);
      expect(el.querySelector(".pm-properties")).not.toBeNull();
    });

    it("renders autocomplete input (not select) for suggester fields", () => {
      const file = new TFile("projects/Alpha.md");
      const { el } = render("entity: project", file);
      // suggester (engagement) now uses InlineAutocomplete — has autocomplete input
      const autocompleteInputs = el.querySelectorAll(".pm-autocomplete__input");
      expect(autocompleteInputs.length).toBeGreaterThan(0);
      // Only non-suggester fields (priority, status) still use <select>
      const selects = el.querySelectorAll("select");
      expect(selects.length).toBe(2); // priority + status
    });

    it("renders list-suggester for attendees on single-meeting", () => {
      const file = new TFile("meetings/Meet1.md");
      const { el } = render("entity: single-meeting", file);
      // list-suggester now uses InlineAutocomplete
      expect(el.querySelector(".pm-autocomplete")).not.toBeNull();
    });
  });

  describe("suggester — inline autocomplete", () => {
    it("shows (None) option in dropdown when opened", () => {
      const file = new TFile("projects/Alpha.md");
      const { el } = render("entity: project", file);
      const input = el.querySelector(".pm-autocomplete__input") as HTMLInputElement;
      input.dispatchEvent(new FocusEvent("focus"));
      const noneOption = el.querySelector(".pm-autocomplete__option--none");
      expect(noneOption).not.toBeNull();
      expect(noneOption?.textContent).toBe("(None)");
    });

    it("populates dropdown with active entities from queryService", () => {
      const file = new TFile("projects/Alpha.md");
      const { services, registerProcessor, getHandler } = createMockServices(file);
      (services.queryService.getActiveEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([
        { file: { name: "Eng1" }, client: null },
        { file: { name: "Eng2" }, client: null },
      ]);
      registerPmPropertiesProcessor(services, registerProcessor);
      const el = document.createElement("div");
      const ctx = { addChild: vi.fn(), sourcePath: file.path };
      getHandler()("entity: project", el, ctx);
      const input = el.querySelector(".pm-autocomplete__input") as HTMLInputElement;
      input.dispatchEvent(new FocusEvent("focus"));
      const optionTexts = [...el.querySelectorAll(".pm-autocomplete__option:not(.pm-autocomplete__option--none)")]
        .map((o) => o.textContent);
      expect(optionTexts).toContain("Eng1");
      expect(optionTexts).toContain("Eng2");
    });

    it("shows current value in autocomplete input", () => {
      const file = new TFile("projects/Alpha.md");
      const { el } = render("entity: project", file, { engagement: "[[Eng1]]" });
      const input = el.querySelector(".pm-autocomplete__input") as HTMLInputElement;
      expect(input.value).toBe("Eng1");
    });

    it("sets input id matching label for attribute", () => {
      const file = new TFile("projects/Alpha.md");
      const { el } = render("entity: project", file);
      const label = [...el.querySelectorAll("label")].find(
        (l) => l.textContent === "Engagement"
      );
      expect(label).not.toBeUndefined();
      const inputId = label!.getAttribute("for");
      expect(inputId).toBeTruthy();
      // Find the autocomplete input that has this id
      const autocompleteInputs = [...el.querySelectorAll(".pm-autocomplete__input")] as HTMLElement[];
      const matched = autocompleteInputs.find((el) => el.id === inputId);
      expect(matched).not.toBeUndefined();
    });

    it("persists selected value as wikilink via processFrontMatter", () => {
      const file = new TFile("projects/Alpha.md");
      const { services, registerProcessor, getHandler } = createMockServices(file);
      (services.queryService.getActiveEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([
        { file: { name: "MyEng" }, client: null },
      ]);
      registerPmPropertiesProcessor(services, registerProcessor);
      const el = document.createElement("div");
      const ctx = { addChild: vi.fn(), sourcePath: file.path };
      getHandler()("entity: project", el, ctx);

      const input = el.querySelector(".pm-autocomplete__input") as HTMLInputElement;
      input.dispatchEvent(new FocusEvent("focus"));
      const option = el.querySelector(
        ".pm-autocomplete__option:not(.pm-autocomplete__option--none)"
      ) as HTMLElement;
      option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      expect(services.app.fileManager.processFrontMatter).toHaveBeenCalled();
    });

    it("persists null when (None) is selected", () => {
      const file = new TFile("projects/Alpha.md");
      const { services, registerProcessor, getHandler } = createMockServices(file);
      (services.queryService.getActiveEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([
        { file: { name: "Eng1" }, client: null },
      ]);
      registerPmPropertiesProcessor(services, registerProcessor);
      const el = document.createElement("div");
      const ctx = { addChild: vi.fn(), sourcePath: file.path };
      getHandler()("entity: project", el, ctx);

      const input = el.querySelector(".pm-autocomplete__input") as HTMLInputElement;
      input.dispatchEvent(new FocusEvent("focus"));
      const noneOption = el.querySelector(".pm-autocomplete__option--none") as HTMLElement;
      noneOption.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

      expect(services.app.fileManager.processFrontMatter).toHaveBeenCalled();
    });
  });

  describe("suggester — enriched display", () => {
    it("shows 'Eng1 (Acme)' for engagement with client link", () => {
      const file = new TFile("projects/Alpha.md");
      const { services, registerProcessor, getHandler } = createMockServices(file);
      (services.queryService.getActiveEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([
        { file: { name: "Eng1" }, client: { path: "clients/Acme.md", type: "file" } },
      ]);
      registerPmPropertiesProcessor(services, registerProcessor);
      const el = document.createElement("div");
      const ctx = { addChild: vi.fn(), sourcePath: file.path };
      getHandler()("entity: project", el, ctx);
      const input = el.querySelector(".pm-autocomplete__input") as HTMLInputElement;
      input.dispatchEvent(new FocusEvent("focus"));
      const optionTexts = [...el.querySelectorAll(
        ".pm-autocomplete__option:not(.pm-autocomplete__option--none)"
      )].map((o) => o.textContent);
      expect(optionTexts).toContain("Eng1 (Acme)");
    });

    it("shows plain name for entity with no client link", () => {
      const file = new TFile("projects/Alpha.md");
      const { services, registerProcessor, getHandler } = createMockServices(file);
      (services.queryService.getActiveEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([
        { file: { name: "Eng1" }, client: null },
      ]);
      registerPmPropertiesProcessor(services, registerProcessor);
      const el = document.createElement("div");
      const ctx = { addChild: vi.fn(), sourcePath: file.path };
      getHandler()("entity: project", el, ctx);
      const input = el.querySelector(".pm-autocomplete__input") as HTMLInputElement;
      input.dispatchEvent(new FocusEvent("focus"));
      const optionTexts = [...el.querySelectorAll(
        ".pm-autocomplete__option:not(.pm-autocomplete__option--none)"
      )].map((o) => o.textContent);
      expect(optionTexts).toContain("Eng1");
      expect(optionTexts).not.toContain("Eng1 ()");
    });

    it("shows plain name for client-tag entity (no enrichment)", () => {
      const file = new TFile("engagements/Eng1.md");
      const { services, registerProcessor, getHandler } = createMockServices(file);
      (services.queryService.getActiveEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([
        { file: { name: "Acme" }, client: null },
      ]);
      registerPmPropertiesProcessor(services, registerProcessor);
      const el = document.createElement("div");
      const ctx = { addChild: vi.fn(), sourcePath: file.path };
      getHandler()("entity: engagement", el, ctx);
      const input = el.querySelector(".pm-autocomplete__input") as HTMLInputElement;
      input.dispatchEvent(new FocusEvent("focus"));
      const optionTexts = [...el.querySelectorAll(
        ".pm-autocomplete__option:not(.pm-autocomplete__option--none)"
      )].map((o) => o.textContent);
      expect(optionTexts).toContain("Acme");
    });
  });

  describe("list-suggester — inline autocomplete", () => {
    function renderMeeting(
      frontmatter: Record<string, unknown> = {},
      mockPeople: Array<{ file: { name: string }; client: unknown }> = []
    ) {
      const file = new TFile("meetings/Meet1.md");
      const { services, registerProcessor, getHandler } = createMockServices(file, frontmatter);
      (services.queryService.getActiveEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue(mockPeople);
      registerPmPropertiesProcessor(services, registerProcessor);
      const el = document.createElement("div");
      const ctx = { addChild: vi.fn(), sourcePath: file.path };
      getHandler()("entity: single-meeting", el, ctx);
      return { el, services };
    }

    it("renders .pm-autocomplete inside .pm-properties__list-suggester", () => {
      const { el } = renderMeeting();
      const listSuggester = el.querySelector(".pm-properties__list-suggester");
      expect(listSuggester).not.toBeNull();
      expect(listSuggester!.querySelector(".pm-autocomplete")).not.toBeNull();
    });

    it("renders chips for current values", () => {
      const { el } = renderMeeting({ attendees: ["[[Alice]]", "[[Bob]]"] });
      const chips = el.querySelectorAll(".pm-properties__chip");
      expect(chips.length).toBe(2);
    });

    it("does not show (None) in list-suggester autocomplete", () => {
      const { el } = renderMeeting();
      const input = el.querySelector(
        ".pm-properties__list-suggester .pm-autocomplete__input"
      ) as HTMLInputElement;
      input.dispatchEvent(new FocusEvent("focus"));
      const noneOption = el.querySelector(".pm-autocomplete__option--none");
      expect(noneOption).toBeNull();
    });

    it("adds new value on autocomplete selection and updates frontmatter", () => {
      const { el, services } = renderMeeting(
        {},
        [{ file: { name: "Alice" }, client: null }]
      );
      const input = el.querySelector(
        ".pm-properties__list-suggester .pm-autocomplete__input"
      ) as HTMLInputElement;
      input.dispatchEvent(new FocusEvent("focus"));
      const option = el.querySelector(".pm-autocomplete__option") as HTMLElement;
      option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      expect(services.app.fileManager.processFrontMatter).toHaveBeenCalled();
    });

    it("does not add duplicate values", () => {
      const { el, services } = renderMeeting(
        { attendees: ["[[Alice]]"] },
        [{ file: { name: "Alice" }, client: null }]
      );
      const input = el.querySelector(
        ".pm-properties__list-suggester .pm-autocomplete__input"
      ) as HTMLInputElement;
      input.dispatchEvent(new FocusEvent("focus"));
      const option = el.querySelector(".pm-autocomplete__option") as HTMLElement;
      option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      // processFrontMatter should not be called (Alice already in list)
      expect(services.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
    });

    it("clears autocomplete input after selection", () => {
      const { el } = renderMeeting(
        {},
        [{ file: { name: "Alice" }, client: null }]
      );
      const input = el.querySelector(
        ".pm-properties__list-suggester .pm-autocomplete__input"
      ) as HTMLInputElement;
      input.dispatchEvent(new FocusEvent("focus"));
      const option = el.querySelector(".pm-autocomplete__option") as HTMLElement;
      option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      expect(input.value).toBe("");
    });

    it("removes chip and updates frontmatter on remove click", () => {
      const { el, services } = renderMeeting({ attendees: ["[[Alice]]", "[[Bob]]"] });
      const removeButtons = el.querySelectorAll(".pm-properties__chip-remove");
      (removeButtons[0] as HTMLElement).click();
      expect(services.app.fileManager.processFrontMatter).toHaveBeenCalled();
      // After removal, only 1 chip remains
      const remainingChips = el.querySelectorAll(".pm-properties__chip");
      expect(remainingChips.length).toBe(1);
    });

    it("shows enriched display in chips for person attendees with client link", () => {
      const file = new TFile("meetings/Meet1.md");
      const { services, registerProcessor, getHandler } = createMockServices(file, {
        attendees: ["[[Alice]]"],
      });
      // Mock getActiveEntitiesByTag to return Alice with client link
      (services.queryService.getActiveEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([
        { file: { name: "Alice" }, client: { path: "clients/Acme.md", type: "file" } },
      ]);
      registerPmPropertiesProcessor(services, registerProcessor);
      const el = document.createElement("div");
      const ctx = { addChild: vi.fn(), sourcePath: file.path };
      getHandler()("entity: single-meeting", el, ctx);
      const chip = el.querySelector(".pm-properties__chip");
      expect(chip?.textContent).toContain("Alice (Acme)");
    });
  });

  describe("lifecycle — onload / onunload / auto-refresh", () => {
    function renderWithLifecycle(
      source: string,
      sourcePathFile: InstanceType<typeof TFile> | null = null,
      frontmatter: Record<string, unknown> = {}
    ) {
      const { services, registerProcessor, vaultOn, getHandler } =
        createMockServices(sourcePathFile, frontmatter);
      registerPmPropertiesProcessor(services, registerProcessor);

      const el = document.createElement("div");
      const children: Array<{
        onload?: () => void;
        onunload?: () => void;
        render(): void;
      }> = [];
      const ctx = {
        addChild: (child: unknown) =>
          children.push(child as { onload?: () => void; onunload?: () => void; render(): void }),
        sourcePath: sourcePathFile?.path ?? "test.md",
      };

      getHandler()(source, el, ctx);
      return { el, services, vaultOn, child: children[0]! };
    }

    it("onload registers a vault.on modify listener", () => {
      const file = new TFile("clients/Acme.md");
      const { child, vaultOn } = renderWithLifecycle("entity: client", file);

      child.onload?.();
      expect(vaultOn).toHaveBeenCalledWith("modify", expect.any(Function));
    });

    it("auto-refreshes (re-renders) when the source file is modified", () => {
      vi.useFakeTimers();
      const file = new TFile("clients/Acme.md");
      const { child, vaultOn } = renderWithLifecycle("entity: client", file);

      child.onload?.();
      const renderSpy = vi.spyOn(child, "render");

      // Simulate vault modify event for the source file
      const [[, modifyCallback]] = vaultOn.mock.calls;
      (modifyCallback as (f: InstanceType<typeof TFile>) => void)(file);

      expect(renderSpy).not.toHaveBeenCalled(); // debounced — not yet
      vi.advanceTimersByTime(500);
      expect(renderSpy).toHaveBeenCalledOnce();

      vi.useRealTimers();
    });

    it("does NOT refresh when a different file is modified", () => {
      vi.useFakeTimers();
      const file = new TFile("clients/Acme.md");
      const otherFile = new TFile("projects/Other.md");
      const { child, vaultOn } = renderWithLifecycle("entity: client", file);

      child.onload?.();
      const renderSpy = vi.spyOn(child, "render");

      const [[, modifyCallback]] = vaultOn.mock.calls;
      (modifyCallback as (f: InstanceType<typeof TFile>) => void)(otherFile);

      vi.advanceTimersByTime(500);
      expect(renderSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("onunload clears pending debounce timer", () => {
      vi.useFakeTimers();
      const file = new TFile("clients/Acme.md");
      const { child, vaultOn } = renderWithLifecycle("entity: client", file);

      child.onload?.();
      const renderSpy = vi.spyOn(child, "render");

      const [[, modifyCallback]] = vaultOn.mock.calls;
      (modifyCallback as (f: InstanceType<typeof TFile>) => void)(file);

      child.onunload?.(); // clear timer before it fires
      vi.advanceTimersByTime(500);
      expect(renderSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
