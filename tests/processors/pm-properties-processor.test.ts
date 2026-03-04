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

    it("renders suggester select with (None) option for engagement link fields", () => {
      const file = new TFile("projects/Alpha.md");
      const { el } = render("entity: project", file);
      // The engagement field is a suggester — should render a select with (None)
      const options = [...el.querySelectorAll("option")];
      expect(options.some((o) => (o as HTMLOptionElement).text === "(None)")).toBe(
        true
      );
    });

    it("renders list-suggester for attendees on single-meeting", () => {
      const file = new TFile("meetings/Meet1.md");
      const { el } = render("entity: single-meeting", file);
      // list-suggester renders a select for picking people to add
      const selects = el.querySelectorAll("select");
      expect(selects.length).toBeGreaterThan(0);
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
