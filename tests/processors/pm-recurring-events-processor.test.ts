import { describe, it, expect, vi } from "vitest";
import { registerPmRecurringEventsProcessor } from "../../src/processors/pm-recurring-events-processor";
import { TFile } from "../mocks/obsidian-mock";
import type { PluginServices, RegisterProcessorFn } from "../../src/plugin-context";

// ─── Mock services factory ────────────────────────────────────────────────

function createMockServices(
  sourcePath = "meetings/recurring/Weekly Standup.md",
  events: Array<{
    name: string;
    path: string;
    date?: string;
    attendees?: string[];
    content?: string;
  }> = []
) {
  let registeredHandler:
    | ((
        source: string,
        el: HTMLElement,
        ctx: {
          addChild: (c: {
            render(): void | Promise<void>;
            onload?(): void;
            onunload?(): void;
            registerEvent?(ref: unknown): void;
          }) => void;
          sourcePath: string;
        }
      ) => void)
    | null = null;

  const vaultOn = vi.fn(() => ({ id: "mock-event" }));

  const registerProcessor: RegisterProcessorFn = vi.fn((_lang, handler) => {
    registeredHandler = handler;
  });

  // Build the mock dataview pages for the events
  const mockEvents = events.map((e) => ({
    file: {
      name: e.name,
      path: e.path,
      folder: e.path.split("/").slice(0, -1).join("/"),
    },
    date: e.date ?? e.name,
    attendees: e.attendees ?? [],
  }));

  // Map from path to content for vault.read
  const contentMap = new Map(
    events.map((e) => [e.path, e.content ?? ""])
  );

  // Build a file map so getAbstractFileByPath returns TFile instances
  const fileMap = new Map(events.map((e) => [e.path, new TFile(e.path)]));

  const services = {
    app: {
      vault: {
        on: vaultOn,
        read: vi.fn(async (file: TFile) => contentMap.get(file.path) ?? ""),
        getAbstractFileByPath: vi.fn((path: string) => fileMap.get(path) ?? null),
      },
    },
    queryService: {
      getRecurringMeetingEvents: vi.fn(() => mockEvents),
    },
  } as unknown as PluginServices;

  return {
    services,
    registerProcessor,
    vaultOn,
    getHandler: () => registeredHandler!,
    sourcePath,
  };
}

// ─── Render helper ─────────────────────────────────────────────────────────

function render(
  events: Array<{
    name: string;
    path: string;
    date?: string;
    attendees?: string[];
    content?: string;
  }> = [],
  sourcePath = "meetings/recurring/Weekly Standup.md"
) {
  const { services, registerProcessor, getHandler, vaultOn } = createMockServices(
    sourcePath,
    events
  );
  registerPmRecurringEventsProcessor(services, registerProcessor);

  const el = document.createElement("div");
  const children: Array<{
    render(): void | Promise<void>;
    onload?(): void;
    onunload?(): void;
    registerEvent?(ref: unknown): void;
  }> = [];
  const ctx = {
    addChild: (child: (typeof children)[0]) => {
      children.push(child);
    },
    sourcePath,
  };

  getHandler()("", el, ctx);
  return { el, children, vaultOn, services };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("pm-recurring-events processor", () => {
  it("registers a 'pm-recurring-events' code block processor", () => {
    const { services, registerProcessor } = createMockServices();
    registerPmRecurringEventsProcessor(services, registerProcessor);
    expect(registerProcessor).toHaveBeenCalledWith("pm-recurring-events", expect.any(Function));
  });

  it("renders empty state when no events exist", () => {
    const { el } = render([]);
    const emptyState = el.querySelector(".pm-recurring-events__empty");
    expect(emptyState).not.toBeNull();
    expect(emptyState?.textContent).toContain("No events yet");
  });

  it("renders a grid when events exist", async () => {
    const { el, children } = render([
      {
        name: "2024-03-01",
        path: "meetings/recurring-events/Weekly Standup/2024-03-01.md",
        date: "2024-03-01",
        attendees: ["[[Alice]]"],
        content: "---\ndate: 2024-03-01\n---\n# Notes\n- Discussed roadmap",
      },
    ]);

    // child.render() is called immediately inside the handler via child.render()
    // but renderAll is async so tiles are rendered asynchronously
    // Wait for the async renderAll to complete
    await new Promise((r) => setTimeout(r, 10));

    const grid = el.querySelector(".pm-recurring-events__grid");
    expect(grid).not.toBeNull();
  });

  it("renders one tile per event", async () => {
    const { el } = render([
      {
        name: "2024-03-01",
        path: "meetings/recurring-events/Weekly Standup/2024-03-01.md",
        date: "2024-03-01",
        content: "",
      },
      {
        name: "2024-03-08",
        path: "meetings/recurring-events/Weekly Standup/2024-03-08.md",
        date: "2024-03-08",
        content: "",
      },
    ]);

    // Wait for async tile rendering
    await new Promise((r) => setTimeout(r, 10));

    const tiles = el.querySelectorAll(".pm-recurring-events__tile");
    expect(tiles.length).toBe(2);
  });

  it("auto-refresh is registered on vault modify in onload()", () => {
    const { services, registerProcessor, getHandler, vaultOn } = createMockServices(
      "meetings/recurring/Weekly Standup.md",
      []
    );
    registerPmRecurringEventsProcessor(services, registerProcessor);

    const el = document.createElement("div");
    let capturedChild: {
      onload?(): void;
      registerEvent?(ref: unknown): void;
    } | null = null;
    const ctx = {
      addChild: (child: typeof capturedChild) => {
        capturedChild = child;
      },
      sourcePath: "meetings/recurring/Weekly Standup.md",
    };

    getHandler()("", el, ctx);
    capturedChild?.onload?.();

    expect(vaultOn).toHaveBeenCalledWith("modify", expect.any(Function));
  });

  it("cleanup: onunload clears debounce timer before it fires", () => {
    vi.useFakeTimers();

    const { services, registerProcessor, getHandler } = createMockServices(
      "meetings/recurring/Weekly Standup.md",
      []
    );
    registerPmRecurringEventsProcessor(services, registerProcessor);

    const el = document.createElement("div");
    let capturedChild: {
      render?(): void | Promise<void>;
      onload?(): void;
      onunload?(): void;
      registerEvent?(ref: unknown): void;
    } | null = null;
    const ctx = {
      addChild: (child: typeof capturedChild) => {
        capturedChild = child;
      },
      sourcePath: "meetings/recurring/Weekly Standup.md",
    };

    getHandler()("", el, ctx);
    capturedChild?.onload?.();

    // Capture render spy after onload so we can check it isn't called
    const renderSpy = vi.spyOn(capturedChild!, "render" as keyof typeof capturedChild);

    // Trigger the vault modify event to start debounce timer
    const vaultOnCalls = (services.app.vault.on as ReturnType<typeof vi.fn>).mock.calls;
    expect(vaultOnCalls.length).toBeGreaterThan(0);
    const modifyCallback = vaultOnCalls[0][1] as () => void;
    modifyCallback();

    // Unload before timer fires
    capturedChild?.onunload?.();
    vi.advanceTimersByTime(1500);

    // render should NOT have been called because timer was cleared
    expect(renderSpy).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("renders notes via MarkdownRenderer (not raw textContent)", async () => {
    const { el } = render([
      {
        name: "2024-03-01",
        path: "meetings/recurring-events/Weekly Standup/2024-03-01.md",
        date: "2024-03-01",
        content: "---\ndate: 2024-03-01\n---\n# Notes\n**bold text**",
      },
    ]);

    await new Promise((r) => setTimeout(r, 10));

    const notesDiv = el.querySelector(".pm-recurring-events__tile-notes");
    expect(notesDiv).not.toBeNull();
    // MarkdownRenderer.render sets innerHTML — not textContent
    expect(notesDiv?.innerHTML).toContain("**bold text**");
    // textContent should not equal raw markdown verbatim (it would be wrapped in <p>)
    expect(notesDiv?.textContent).toContain("**bold text**");
  });

  it("preserves leading dashes in notes (regex fix)", async () => {
    const { el } = render([
      {
        name: "2024-03-01",
        path: "meetings/recurring-events/Weekly Standup/2024-03-01.md",
        date: "2024-03-01",
        content: "---\ndate: 2024-03-01\n---\n# Notes\n- item one\n- item two",
      },
    ]);

    await new Promise((r) => setTimeout(r, 10));

    const notesDiv = el.querySelector(".pm-recurring-events__tile-notes");
    expect(notesDiv).not.toBeNull();
    // The leading "- item one" should be preserved, not stripped
    expect(notesDiv?.textContent).toContain("item one");
    expect(notesDiv?.textContent).toContain("item two");
  });

  it("does not render notes div when notes section is absent", async () => {
    const { el } = render([
      {
        name: "2024-03-01",
        path: "meetings/recurring-events/Weekly Standup/2024-03-01.md",
        date: "2024-03-01",
        content: "---\ndate: 2024-03-01\n---\nNo notes heading here.",
      },
    ]);

    await new Promise((r) => setTimeout(r, 10));

    const notesDiv = el.querySelector(".pm-recurring-events__tile-notes");
    expect(notesDiv).toBeNull();
  });

  it("auto-detects meeting name from sourcePath basename", () => {
    const { services, registerProcessor, getHandler } = createMockServices(
      "meetings/recurring/My Special Meeting.md",
      []
    );
    registerPmRecurringEventsProcessor(services, registerProcessor);

    const el = document.createElement("div");
    const ctx = {
      addChild: vi.fn(),
      sourcePath: "meetings/recurring/My Special Meeting.md",
    };

    getHandler()("", el, ctx);

    // queryService.getRecurringMeetingEvents should have been called with the basename
    expect(services.queryService.getRecurringMeetingEvents).toHaveBeenCalledWith(
      "My Special Meeting"
    );
  });

  it("scroll position is restored after render when scrollable parent exists", async () => {
    const { services, registerProcessor, getHandler } = createMockServices(
      "meetings/recurring/Weekly Standup.md",
      [
        {
          name: "2024-03-01",
          path: "meetings/recurring-events/Weekly Standup/2024-03-01.md",
          date: "2024-03-01",
          content: "",
        },
      ]
    );
    registerPmRecurringEventsProcessor(services, registerProcessor);

    // Wrap container in a scrollable parent
    const scrollParent = document.createElement("div");
    // jsdom doesn't perform real layout — mock scrollHeight/clientHeight and getComputedStyle
    Object.defineProperty(scrollParent, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(scrollParent, "clientHeight", { value: 300, configurable: true });
    const origGetComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
      if (el === scrollParent) {
        return { overflowY: "auto" } as CSSStyleDeclaration;
      }
      return origGetComputedStyle(el, pseudo ?? null);
    });

    const el = document.createElement("div");
    scrollParent.appendChild(el);
    document.body.appendChild(scrollParent);

    let capturedChild: { render?(): void | Promise<void> } | null = null;
    const ctx = {
      addChild: (child: typeof capturedChild) => { capturedChild = child; },
      sourcePath: "meetings/recurring/Weekly Standup.md",
    };

    getHandler()("", el, ctx);

    // Simulate user scrolling to position 250
    scrollParent.scrollTop = 250;

    // Call render() directly — this is what debouncedRefresh() does
    await capturedChild?.render?.();

    // Scroll position should be restored to 250
    expect(scrollParent.scrollTop).toBe(250);

    document.body.removeChild(scrollParent);
    vi.restoreAllMocks();
  });
});
