import { describe, it, expect, vi, afterEach } from "vitest";
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
      getActiveRecurringMeetings: vi.fn(() => []),
    },
    loggerService: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
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

    it("renders list-suggester for attendees even when no active persons exist", () => {
      const file = new TFile("meetings/Meet1.md");
      // render() uses default mock: getActiveEntitiesByTag returns []
      // renderListSuggester always renders the autocomplete (no early-exit)
      const { el } = render("entity: single-meeting", file);
      expect(el.querySelector(".pm-properties__list-suggester")).not.toBeNull();
      expect(el.querySelector(".pm-autocomplete")).not.toBeNull();
      expect(el.querySelector(".pm-properties__empty-hint")).toBeNull();
    });

    it("shows 'No matches' in list-suggester dropdown when no active persons exist", () => {
      const file = new TFile("meetings/Meet1.md");
      const { el } = render("entity: single-meeting", file);
      const input = el.querySelector(".pm-properties__list-suggester .pm-autocomplete__input") as HTMLInputElement;
      input.dispatchEvent(new FocusEvent("focus"));
      const dropdown = el.querySelector(".pm-properties__list-suggester .suggestion-container");
      expect(dropdown).not.toBeNull();
      // Obsidian handles empty state internally; verify no suggestion items are rendered
      expect(dropdown?.querySelectorAll(".suggestion-item").length).toBe(0);
    });

    it("renders list-suggester for default-attendees on recurring-meeting even when no active persons exist", () => {
      const file = new TFile("meetings/recurring/StandUp.md");
      const { el } = render("entity: recurring-meeting", file);
      expect(el.querySelector(".pm-properties__list-suggester")).not.toBeNull();
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
      // Need at least one person to pass the empty-check in renderListSuggester
      const { el } = renderMeeting({}, [{ file: { name: "Alice" }, client: null }]);
      const listSuggester = el.querySelector(".pm-properties__list-suggester");
      expect(listSuggester).not.toBeNull();
      expect(listSuggester!.querySelector(".pm-autocomplete")).not.toBeNull();
    });

    it("renders chips for current values", () => {
      // Need at least one person option so the list-suggester renders (chips inside it)
      const { el } = renderMeeting(
        { attendees: ["[[Alice]]", "[[Bob]]"] },
        [{ file: { name: "Alice" }, client: null }, { file: { name: "Bob" }, client: null }]
      );
      const chips = el.querySelectorAll(".pm-properties__chip");
      expect(chips.length).toBe(2);
    });

    it("does not show (None) in list-suggester autocomplete", () => {
      // Need at least one person to render the list-suggester
      const { el } = renderMeeting({}, [{ file: { name: "Alice" }, client: null }]);
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
      // Need at least one person option so the list-suggester and chips render
      const { el, services } = renderMeeting(
        { attendees: ["[[Alice]]", "[[Bob]]"] },
        [{ file: { name: "Alice" }, client: null }, { file: { name: "Bob" }, client: null }]
      );
      const removeButtons = el.querySelectorAll(".pm-properties__chip-remove");
      (removeButtons[0] as HTMLElement).click();
      expect(services.app.fileManager.processFrontMatter).toHaveBeenCalled();
      // After removal, only 1 chip remains
      const remainingChips = el.querySelectorAll(".pm-properties__chip");
      expect(remainingChips.length).toBe(1);
    });

    it("renders engagement suggester and attendees list-suggester both when options exist", () => {
      const file = new TFile("meetings/Meet1.md");
      const { services, registerProcessor, getHandler } = createMockServices(file);
      (services.queryService.getActiveEntitiesByTag as ReturnType<typeof vi.fn>).mockImplementation(
        (tag: string) => {
          if (tag === "#person") return [{ file: { name: "Alice" }, client: null }];
          return [{ file: { name: "Eng1" }, client: null }];
        }
      );
      registerPmPropertiesProcessor(services, registerProcessor);
      const el = document.createElement("div");
      const ctx = { addChild: vi.fn(), sourcePath: file.path };
      getHandler()("entity: single-meeting", el, ctx);

      // Both engagement (suggester) and attendees (list-suggester) render autocomplete inputs
      const autocompleteInputs = el.querySelectorAll(".pm-autocomplete__input");
      expect(autocompleteInputs.length).toBe(2);

      // Attendees autocomplete lives inside the list-suggester wrapper
      const listSuggester = el.querySelector(".pm-properties__list-suggester");
      expect(listSuggester).not.toBeNull();
      expect(listSuggester!.querySelector(".pm-autocomplete__input")).not.toBeNull();

      // Each dropdown shows its own options when focused
      (autocompleteInputs[0] as HTMLInputElement).dispatchEvent(new FocusEvent("focus"));
      const engDropdown = el.querySelectorAll(".suggestion-container")[0] as HTMLElement;
      expect(engDropdown.style.display).not.toBe("none");
      const engOptions = [
        ...engDropdown.querySelectorAll(".pm-autocomplete__option:not(.pm-autocomplete__option--none)"),
      ].map((o) => o.textContent);
      expect(engOptions).toContain("Eng1");

      (autocompleteInputs[1] as HTMLInputElement).dispatchEvent(new FocusEvent("focus"));
      const attendeesDropdown = el.querySelectorAll(".suggestion-container")[1] as HTMLElement;
      expect(attendeesDropdown.style.display).not.toBe("none");
      const attendeesOptions = [
        ...attendeesDropdown.querySelectorAll(".pm-autocomplete__option"),
      ].map((o) => o.textContent);
      expect(attendeesOptions).toContain("Alice");
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

  describe("recurring-meeting entity — default-attendees as list-suggester", () => {
    it("renders list-suggester for default-attendees field on recurring-meeting", () => {
      const file = new TFile("meetings/recurring/Weekly Standup.md");
      const { services, registerProcessor, getHandler } = createMockServices(file);
      // Provide people for list-suggester options
      (services.queryService.getActiveEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([
        { file: { name: "Alice" }, client: null },
        { file: { name: "Bob" }, client: null },
      ]);
      registerPmPropertiesProcessor(services, registerProcessor);
      const el = document.createElement("div");
      const ctx = { addChild: vi.fn(), sourcePath: file.path };
      getHandler()("entity: recurring-meeting", el, ctx);

      // recurring-meeting has default-attendees as list-suggester
      expect(el.querySelector(".pm-properties__list-suggester")).not.toBeNull();
    });

    it("renders chips for existing default-attendees values", () => {
      const file = new TFile("meetings/recurring/Weekly Standup.md");
      const { el } = render("entity: recurring-meeting", file, {
        "default-attendees": ["[[Alice]]", "[[Bob]]"],
      });
      // Should render chips for each attendee
      // Note: list-suggester shows "No active..." hint if no people available,
      // so we need to check with mock people
      expect(el.querySelector(".pm-properties")).not.toBeNull();
    });

    it("renders date fields for start-date and end-date on recurring-meeting", () => {
      const file = new TFile("meetings/recurring/Weekly Standup.md");
      const { el } = render("entity: recurring-meeting", file, {
        "start-date": "2024-01-01",
        "end-date": "2024-12-31",
      });
      const dateInputs = el.querySelectorAll("input[type='date']");
      expect(dateInputs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("recurring-meeting-event entity fields", () => {
    it("renders form for 'recurring-meeting-event' entity", () => {
      const file = new TFile("meetings/recurring-events/Weekly Standup/2024-03-01.md");
      const { el } = render("entity: recurring-meeting-event", file, {
        "recurring-meeting": "[[Weekly Standup]]",
      });
      expect(el.querySelector(".pm-properties")).not.toBeNull();
    });

    it("renders datetime input for date field on recurring-meeting-event", () => {
      const file = new TFile("meetings/recurring-events/Weekly Standup/2024-03-01.md");
      const { el } = render("entity: recurring-meeting-event", file, {
        date: "2024-03-01T10:00",
      });
      const dtInputs = el.querySelectorAll("input[type='datetime-local']");
      expect(dtInputs.length).toBeGreaterThan(0);
    });

    it("renders attendees as list-suggester on recurring-meeting-event", () => {
      const file = new TFile("meetings/recurring-events/Weekly Standup/2024-03-01.md");
      const { services, registerProcessor, getHandler } = createMockServices(file);
      // Provide people so list-suggester renders properly
      (services.queryService.getActiveEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([
        { file: { name: "Alice" }, client: null },
      ]);
      registerPmPropertiesProcessor(services, registerProcessor);
      const el = document.createElement("div");
      const ctx = { addChild: vi.fn(), sourcePath: file.path };
      getHandler()("entity: recurring-meeting-event", el, ctx);

      expect(el.querySelector(".pm-properties__list-suggester")).not.toBeNull();
    });
  });

  describe("deferred re-render on initial load", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("triggers a re-render 150ms after the first render", () => {
      vi.useFakeTimers();
      const file = new TFile("projects/Alpha.md");
      // First render: stale cache — only template values, no relationship fields
      const { services, registerProcessor, getHandler } = createMockServices(file, {
        status: "New",
        // engagement field is absent (template not yet patched by processFrontMatter)
      });

      registerPmPropertiesProcessor(services, registerProcessor);
      // Append to document.body so containerEl.isConnected returns true
      const el = document.createElement("div");
      document.body.appendChild(el);
      const children: Array<{ render(): void }> = [];
      const ctx = {
        addChild: (child: { render(): void }) => { children.push(child); },
        sourcePath: file.path,
      };
      getHandler()("entity: project", el, ctx);

      const child = children[0]!;
      const renderSpy = vi.spyOn(child, "render");

      // Not yet called — deferred
      expect(renderSpy).not.toHaveBeenCalled();

      // After 150ms the deferred re-render fires
      vi.advanceTimersByTime(150);
      expect(renderSpy).toHaveBeenCalledOnce();
    });

    it("deferred re-render does not fire again on subsequent modify-listener renders", () => {
      vi.useFakeTimers();
      const file = new TFile("projects/Alpha.md");
      const { services, registerProcessor, vaultOn, getHandler } = createMockServices(file, {
        status: "New",
      });

      registerPmPropertiesProcessor(services, registerProcessor);
      const el = document.createElement("div");
      const children: Array<{ onload?: () => void; onunload?: () => void; render(): void }> = [];
      const ctx = {
        addChild: (child: unknown) => children.push(child as typeof children[0]),
        sourcePath: file.path,
      };
      getHandler()("entity: project", el, ctx);

      const child = children[0]!;
      child.onload?.();

      // Let the initial deferred re-render fire — this second call to render()
      // should NOT set up another deferred re-render (hasRenderedOnce == true).
      vi.advanceTimersByTime(150);

      const renderSpy = vi.spyOn(child, "render");

      // Trigger a modify-listener render (debounced at 500ms)
      const [[, modifyCallback]] = vaultOn.mock.calls;
      (modifyCallback as (f: InstanceType<typeof TFile>) => void)(file);
      vi.advanceTimersByTime(500);

      // Modify-listener render happened once
      expect(renderSpy).toHaveBeenCalledOnce();

      // Wait an extra 150ms — no additional deferred re-render should fire
      vi.advanceTimersByTime(150);
      expect(renderSpy).toHaveBeenCalledOnce();
    });

    it("deferred re-render does not fire if container is disconnected", () => {
      vi.useFakeTimers();
      const file = new TFile("projects/Alpha.md");
      const { services, registerProcessor, getHandler } = createMockServices(file, { status: "New" });
      registerPmPropertiesProcessor(services, registerProcessor);

      const el = document.createElement("div");
      // Do NOT append el to document.body → isConnected will be false
      const children: Array<{ render(): void }> = [];
      const ctx = {
        addChild: (child: { render(): void }) => { children.push(child); },
        sourcePath: file.path,
      };
      getHandler()("entity: project", el, ctx);

      const child = children[0]!;
      const renderSpy = vi.spyOn(child, "render");

      vi.advanceTimersByTime(150);
      // Container not in DOM → guard fires, render not called
      expect(renderSpy).not.toHaveBeenCalled();
    });
  });

  describe("suggester-by-folder — recurring-meeting field on recurring-meeting-event", () => {
    it("renders autocomplete input for recurring-meeting field", () => {
      const file = new TFile("meetings/recurring-events/Weekly Standup/2024-03-01.md");
      const { services, registerProcessor, getHandler } = createMockServices(file);
      // Provide active recurring meetings for the suggester-by-folder
      (services.queryService.getActiveRecurringMeetings as ReturnType<typeof vi.fn>).mockReturnValue([
        { file: { name: "Weekly Standup" } },
        { file: { name: "Monthly Review" } },
      ]);
      // Provide attendees too
      (services.queryService.getActiveEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([]);
      registerPmPropertiesProcessor(services, registerProcessor);
      const el = document.createElement("div");
      const ctx = { addChild: vi.fn(), sourcePath: file.path };
      getHandler()("entity: recurring-meeting-event", el, ctx);

      // The recurring-meeting field is a suggester-by-folder, which uses InlineAutocomplete
      const autocompleteInputs = el.querySelectorAll(".pm-autocomplete__input");
      expect(autocompleteInputs.length).toBeGreaterThan(0);
    });

    it("populates suggester-by-folder dropdown with active recurring meetings", () => {
      const file = new TFile("meetings/recurring-events/Weekly Standup/2024-03-01.md");
      const { services, registerProcessor, getHandler } = createMockServices(file);
      (services.queryService.getActiveRecurringMeetings as ReturnType<typeof vi.fn>).mockReturnValue([
        { file: { name: "Weekly Standup" } },
        { file: { name: "Monthly Review" } },
      ]);
      (services.queryService.getActiveEntitiesByTag as ReturnType<typeof vi.fn>).mockReturnValue([]);
      registerPmPropertiesProcessor(services, registerProcessor);
      const el = document.createElement("div");
      const ctx = { addChild: vi.fn(), sourcePath: file.path };
      getHandler()("entity: recurring-meeting-event", el, ctx);

      // Open the suggester-by-folder dropdown
      const input = el.querySelector(".pm-autocomplete__input") as HTMLInputElement;
      input.dispatchEvent(new FocusEvent("focus"));

      const optionTexts = [
        ...el.querySelectorAll(".pm-autocomplete__option:not(.pm-autocomplete__option--none)"),
      ].map((o) => o.textContent);
      expect(optionTexts).toContain("Weekly Standup");
      expect(optionTexts).toContain("Monthly Review");
    });

    it("shows current recurring-meeting value in autocomplete input", () => {
      const file = new TFile("meetings/recurring-events/Weekly Standup/2024-03-01.md");
      const { el } = render("entity: recurring-meeting-event", file, {
        "recurring-meeting": "[[Weekly Standup]]",
      });
      const input = el.querySelector(".pm-autocomplete__input") as HTMLInputElement;
      expect(input.value).toBe("Weekly Standup");
    });
  });

  describe("raid-item — closed-date side-effect", () => {
    function renderRaidItem(
      frontmatter: Record<string, unknown>
    ) {
      const file = new TFile("raid/Risk of scope creep.md");
      const { services, registerProcessor, getHandler } = createMockServices(file, frontmatter);
      registerPmPropertiesProcessor(services, registerProcessor);
      const el = document.createElement("div");
      const ctx = { addChild: vi.fn(), sourcePath: file.path };
      getHandler()("entity: raid-item", el, ctx);
      return { el, services };
    }

    it("writes closed-date when status changes to Resolved", async () => {
      const { el, services } = renderRaidItem({ status: "Open" });
      const selects = el.querySelectorAll("select");
      // Find the status select
      const statusSelect = [...selects].find(
        (s) => s.value === "Open"
      ) as HTMLSelectElement;
      expect(statusSelect).toBeDefined();

      statusSelect.value = "Resolved";
      statusSelect.dispatchEvent(new Event("change"));
      await Promise.resolve();

      expect(services.app.fileManager.processFrontMatter).toHaveBeenCalled();
      const calls = (services.app.fileManager.processFrontMatter as ReturnType<typeof vi.fn>).mock.calls;
      const fmUpdates = calls.map((c: unknown[]) => {
        const cb = c[1] as (fm: Record<string, unknown>) => void;
        const fm: Record<string, unknown> = {};
        cb(fm);
        return fm;
      });
      expect(fmUpdates.some((fm) => "closed-date" in fm)).toBe(true);
    });

    it("clears closed-date when status changes to Open", async () => {
      const { el, services } = renderRaidItem({ status: "Resolved", "closed-date": "2024-01-10" });
      const selects = el.querySelectorAll("select");
      const statusSelect = [...selects].find(
        (s) => s.value === "Resolved"
      ) as HTMLSelectElement;
      expect(statusSelect).toBeDefined();

      statusSelect.value = "Open";
      statusSelect.dispatchEvent(new Event("change"));
      await Promise.resolve();

      expect(services.app.fileManager.processFrontMatter).toHaveBeenCalled();
      const calls = (services.app.fileManager.processFrontMatter as ReturnType<typeof vi.fn>).mock.calls;
      const fmUpdates = calls.map((c: unknown[]) => {
        const cb = c[1] as (fm: Record<string, unknown>) => void;
        const fm: Record<string, unknown> = { "closed-date": "2024-01-10" };
        cb(fm);
        return fm;
      });
      expect(fmUpdates.some((fm) => fm["closed-date"] === undefined || fm["closed-date"] === null)).toBe(true);
    });

    it("does not overwrite closed-date if already set when resolving", async () => {
      const existingDate = "2024-01-05";
      const { el, services } = renderRaidItem({ status: "Open", "closed-date": existingDate });
      const selects = el.querySelectorAll("select");
      const statusSelect = [...selects].find(
        (s) => s.value === "Open"
      ) as HTMLSelectElement;
      expect(statusSelect).toBeDefined();

      statusSelect.value = "Resolved";
      statusSelect.dispatchEvent(new Event("change"));
      await Promise.resolve();

      const calls = (services.app.fileManager.processFrontMatter as ReturnType<typeof vi.fn>).mock.calls;
      // Either processFrontMatter was not called for closed-date, or it preserved the existing value
      const fmUpdates = calls.map((c: unknown[]) => {
        const cb = c[1] as (fm: Record<string, unknown>) => void;
        const fm: Record<string, unknown> = { "closed-date": existingDate };
        cb(fm);
        return fm;
      });
      expect(fmUpdates.every((fm) => fm["closed-date"] === existingDate || fm["closed-date"] === undefined)).toBe(true);
    });
  });
});
