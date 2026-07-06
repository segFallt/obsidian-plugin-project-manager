import { describe, it, expect, vi } from "vitest";
import * as obsidian from "obsidian";
import { registerPmRecurringEventsProcessor } from "@/processors/pm-recurring-events-processor";
import { TFile } from "../mocks/obsidian-mock";
import { TaskParser } from "@/services/task-parser";
import type { PluginServices, RegisterProcessorFn } from "@/plugin-context";

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

  const loggerService = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const services = {
    app: {
      vault: {
        on: vaultOn,
        read: vi.fn(async (file: TFile) => contentMap.get(file.path) ?? ""),
        modify: vi.fn(async () => {}),
        getAbstractFileByPath: vi.fn((path: string) => fileMap.get(path) ?? null),
      },
    },
    queryService: {
      getRecurringMeetingEvents: vi.fn(() => mockEvents),
    },
    taskParser: new TaskParser(),
    loggerService,
  } as unknown as PluginServices;

  return {
    services,
    registerProcessor,
    vaultOn,
    loggerService,
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
  const { services, registerProcessor, getHandler, vaultOn, loggerService } =
    createMockServices(sourcePath, events);
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
  return { el, children, vaultOn, services, loggerService };
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

    // Mock requestAnimationFrame to execute synchronously so the height-pin
    // release (containerEl.style.minHeight = "") happens before the assertion.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    getHandler()("", el, ctx);

    // Simulate user scrolling to position 250
    scrollParent.scrollTop = 250;

    // Call render() directly — this is what debouncedRefresh() does
    await capturedChild?.render?.();

    // Scroll position is restored synchronously in the same JS frame as the DOM swap.
    expect(scrollParent.scrollTop).toBe(250);

    // Height pin should be cleared after rAF fires.
    expect(el.style.minHeight).toBe("");

    document.body.removeChild(scrollParent);
    vi.restoreAllMocks();
  });

  it("persists a task-checkbox toggle to the correct absolute line in the event note", async () => {
    // Frontmatter + heading + blank line above the first task, so the tile's
    // trimmed "# Notes" slice starts well below line 0. The second task lives at
    // absolute line 7 — the assertion proves the absolute-line mapping is correct.
    const content = [
      "---", // line 0
      "date: 2024-03-01", // line 1
      "---", // line 2
      "", // line 3
      "# Notes", // line 4
      "", // line 5
      "- [ ] first task", // line 6
      "- [ ] second task 📅 2024-04-01", // line 7
    ].join("\n");

    const { el, services } = render([
      {
        name: "2024-03-01",
        path: "meetings/recurring-events/Weekly Standup/2024-03-01.md",
        date: "2024-03-01",
        content,
      },
    ]);

    await new Promise((r) => setTimeout(r, 10));

    const notesDiv = el.querySelector<HTMLElement>(".pm-recurring-events__tile-notes");
    expect(notesDiv).not.toBeNull();

    // The obsidian mock's MarkdownRenderer does not emit real task checkboxes,
    // so inject the DOM Obsidian would produce (one checkbox per task line).
    const boxes = injectTaskCheckboxes(notesDiv!, 2);

    // Toggle the SECOND task -> should rewrite absolute line 7 only.
    boxes[1].checked = true;
    boxes[1].dispatchEvent(new Event("change", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));

    const modify = services.app.vault.modify as ReturnType<typeof vi.fn>;
    expect(modify).toHaveBeenCalledTimes(1);

    const writtenLines = (modify.mock.calls[0][1] as string).split("\n");
    expect(writtenLines[7]).toContain("[x]");
    expect(writtenLines[7]).toContain("second task");
    // Untouched task line is preserved.
    expect(writtenLines[6]).toBe("- [ ] first task");
  });

  // ─── Negative paths (no data corruption/loss on failure) ──────────────────

  it("negative: a rejected vault.modify is caught, logs, and shows a Notice (no unhandled rejection)", async () => {
    const noticeSpy = vi
      .spyOn(obsidian, "Notice")
      .mockImplementation(() => ({}) as unknown as obsidian.Notice);
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    const content = ["---", "date: 2024-03-01", "---", "# Notes", "- [ ] a task"].join("\n");
    const { el, services, loggerService } = render([
      {
        name: "2024-03-01",
        path: "meetings/recurring-events/Weekly Standup/2024-03-01.md",
        date: "2024-03-01",
        content,
      },
    ]);

    await new Promise((r) => setTimeout(r, 10));

    // Force the write to reject — simulates a disk/permission failure.
    (services.app.vault.modify as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("disk full")
    );

    const notesDiv = el.querySelector<HTMLElement>(".pm-recurring-events__tile-notes");
    const boxes = injectTaskCheckboxes(notesDiv!, 1);
    boxes[0].checked = true;
    boxes[0].dispatchEvent(new Event("change", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));

    expect(loggerService.error).toHaveBeenCalledTimes(1);
    expect(noticeSpy).toHaveBeenCalledTimes(1);
    expect(unhandled).not.toHaveBeenCalled();

    process.off("unhandledRejection", unhandled);
    noticeSpy.mockRestore();
  });

  it("negative: checkboxIndex out of range makes no vault.modify call", async () => {
    const content = ["---", "date: 2024-03-01", "---", "# Notes", "- [ ] only task"].join("\n");
    const { el, services } = render([
      {
        name: "2024-03-01",
        path: "meetings/recurring-events/Weekly Standup/2024-03-01.md",
        date: "2024-03-01",
        content,
      },
    ]);

    await new Promise((r) => setTimeout(r, 10));

    const notesDiv = el.querySelector<HTMLElement>(".pm-recurring-events__tile-notes");
    // Inject TWO checkboxes though only one task line exists — toggling the
    // second maps to no task line.
    const boxes = injectTaskCheckboxes(notesDiv!, 2);
    boxes[1].checked = true;
    boxes[1].dispatchEvent(new Event("change", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));

    expect(services.app.vault.modify).not.toHaveBeenCalled();
  });

  it("negative: absent '# Notes' marker at persist time returns early with no vault.modify", async () => {
    const content = ["---", "date: 2024-03-01", "---", "# Notes", "- [ ] a task"].join("\n");
    const { el, services } = render([
      {
        name: "2024-03-01",
        path: "meetings/recurring-events/Weekly Standup/2024-03-01.md",
        date: "2024-03-01",
        content,
      },
    ]);

    await new Promise((r) => setTimeout(r, 10));

    const notesDiv = el.querySelector<HTMLElement>(".pm-recurring-events__tile-notes");
    const boxes = injectTaskCheckboxes(notesDiv!, 1);

    // The note loses its '# Notes' heading before the toggle is persisted.
    (services.app.vault.read as ReturnType<typeof vi.fn>).mockResolvedValue(
      "---\ndate: 2024-03-01\n---\nNo notes heading here."
    );

    boxes[0].checked = true;
    boxes[0].dispatchEvent(new Event("change", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));

    expect(services.app.vault.modify).not.toHaveBeenCalled();
  });

  it("negative: empty notes slice returns early with no vault.modify", async () => {
    const content = ["---", "date: 2024-03-01", "---", "# Notes", "- [ ] a task"].join("\n");
    const { el, services } = render([
      {
        name: "2024-03-01",
        path: "meetings/recurring-events/Weekly Standup/2024-03-01.md",
        date: "2024-03-01",
        content,
      },
    ]);

    await new Promise((r) => setTimeout(r, 10));

    const notesDiv = el.querySelector<HTMLElement>(".pm-recurring-events__tile-notes");
    const boxes = injectTaskCheckboxes(notesDiv!, 1);

    // The note's '# Notes' section becomes empty before the toggle is persisted.
    (services.app.vault.read as ReturnType<typeof vi.fn>).mockResolvedValue(
      "---\ndate: 2024-03-01\n---\n# Notes\n"
    );

    boxes[0].checked = true;
    boxes[0].dispatchEvent(new Event("change", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));

    expect(services.app.vault.modify).not.toHaveBeenCalled();
  });

  // ─── Boundary cases ───────────────────────────────────────────────────────

  it("boundary: duplicate task text — toggling index 1 rewrites the SECOND line, not the first", async () => {
    // Two task lines with identical text. Text matching would be ambiguous;
    // only the positional Nth-checkbox→Nth-task-line mapping resolves this.
    const content = [
      "---", // 0
      "date: 2024-03-01", // 1
      "---", // 2
      "# Notes", // 3
      "", // 4
      "- [ ] duplicate task", // 5
      "- [ ] duplicate task", // 6
    ].join("\n");

    const { el, services } = render([
      {
        name: "2024-03-01",
        path: "meetings/recurring-events/Weekly Standup/2024-03-01.md",
        date: "2024-03-01",
        content,
      },
    ]);

    await new Promise((r) => setTimeout(r, 10));

    const notesDiv = el.querySelector<HTMLElement>(".pm-recurring-events__tile-notes");
    const boxes = injectTaskCheckboxes(notesDiv!, 2);
    boxes[1].checked = true;
    boxes[1].dispatchEvent(new Event("change", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));

    const modify = services.app.vault.modify as ReturnType<typeof vi.fn>;
    expect(modify).toHaveBeenCalledTimes(1);
    const writtenLines = (modify.mock.calls[0][1] as string).split("\n");
    // Second identical line toggled; first identical line untouched.
    expect(writtenLines[6]).toContain("[x]");
    expect(writtenLines[5]).toBe("- [ ] duplicate task");
  });

  it("boundary: first checkbox (index 0) toggles the first task line", async () => {
    const content = [
      "---", // 0
      "date: 2024-03-01", // 1
      "---", // 2
      "# Notes", // 3
      "", // 4
      "- [ ] first task", // 5
      "- [ ] second task", // 6
    ].join("\n");

    const { el, services } = render([
      {
        name: "2024-03-01",
        path: "meetings/recurring-events/Weekly Standup/2024-03-01.md",
        date: "2024-03-01",
        content,
      },
    ]);

    await new Promise((r) => setTimeout(r, 10));

    const notesDiv = el.querySelector<HTMLElement>(".pm-recurring-events__tile-notes");
    const boxes = injectTaskCheckboxes(notesDiv!, 2);
    boxes[0].checked = true;
    boxes[0].dispatchEvent(new Event("change", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));

    const modify = services.app.vault.modify as ReturnType<typeof vi.fn>;
    expect(modify).toHaveBeenCalledTimes(1);
    const writtenLines = (modify.mock.calls[0][1] as string).split("\n");
    expect(writtenLines[5]).toContain("[x]");
    expect(writtenLines[6]).toBe("- [ ] second task");
  });

  it("boundary: an already-checked task toggled to unchecked rewrites correctly", async () => {
    const content = [
      "---", // 0
      "date: 2024-03-01", // 1
      "---", // 2
      "# Notes", // 3
      "", // 4
      "- [x] done task", // 5
    ].join("\n");

    const { el, services } = render([
      {
        name: "2024-03-01",
        path: "meetings/recurring-events/Weekly Standup/2024-03-01.md",
        date: "2024-03-01",
        content,
      },
    ]);

    await new Promise((r) => setTimeout(r, 10));

    const notesDiv = el.querySelector<HTMLElement>(".pm-recurring-events__tile-notes");
    const boxes = injectTaskCheckboxes(notesDiv!, 1);
    boxes[0].checked = false;
    boxes[0].dispatchEvent(new Event("change", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));

    const modify = services.app.vault.modify as ReturnType<typeof vi.fn>;
    expect(modify).toHaveBeenCalledTimes(1);
    const writtenLines = (modify.mock.calls[0][1] as string).split("\n");
    expect(writtenLines[5]).toContain("[ ]");
    expect(writtenLines[5]).not.toContain("[x]");
  });

  it("boundary: first task on the very first line of the notes slice (no blank line before it)", async () => {
    // No blank line between '# Notes' and the first task, so the slice starts
    // immediately at the task line.
    const content = [
      "---", // 0
      "date: 2024-03-01", // 1
      "---", // 2
      "# Notes", // 3
      "- [ ] immediate task", // 4
    ].join("\n");

    const { el, services } = render([
      {
        name: "2024-03-01",
        path: "meetings/recurring-events/Weekly Standup/2024-03-01.md",
        date: "2024-03-01",
        content,
      },
    ]);

    await new Promise((r) => setTimeout(r, 10));

    const notesDiv = el.querySelector<HTMLElement>(".pm-recurring-events__tile-notes");
    const boxes = injectTaskCheckboxes(notesDiv!, 1);
    boxes[0].checked = true;
    boxes[0].dispatchEvent(new Event("change", { bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));

    const modify = services.app.vault.modify as ReturnType<typeof vi.fn>;
    expect(modify).toHaveBeenCalledTimes(1);
    const writtenLines = (modify.mock.calls[0][1] as string).split("\n");
    // Absolute line 4 (not line 3 '# Notes') is the one rewritten.
    expect(writtenLines[4]).toContain("[x]");
    expect(writtenLines[3]).toBe("# Notes");
  });
});

/** Injects the task-list DOM Obsidian would render for `count` task lines. */
function injectTaskCheckboxes(notesDiv: HTMLElement, count: number): HTMLInputElement[] {
  const ul = document.createElement("ul");
  ul.className = "contains-task-list";
  const boxes: HTMLInputElement[] = [];
  for (let i = 0; i < count; i++) {
    const li = document.createElement("li");
    li.className = "task-list-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-list-item-checkbox";
    li.appendChild(checkbox);
    ul.appendChild(li);
    boxes.push(checkbox);
  }
  notesDiv.appendChild(ul);
  return boxes;
}
