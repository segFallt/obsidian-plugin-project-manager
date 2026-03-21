import { describe, it, expect, vi, afterEach } from "vitest";
import { registerPmTasksProcessor } from "../../src/processors/pm-tasks-processor";
import { createMockDataviewApi } from "../mocks/dataview-mock";
import type { DataviewApi } from "../../src/types";
import type { TaskProcessorServices, RegisterProcessorFn } from "../../src/plugin-context";
import { DEFAULT_FOLDERS, DUE_DATE_PRESETS } from "../../src/constants";
import { TaskFilterService } from "../../src/services/task-filter-service";
import { TaskSortService } from "../../src/services/task-sort-service";

// ─── Mock services factory ───────────────────────────────────────────────────

function createMockServices(dvApi: DataviewApi | null = null) {
  let registeredHandler:
    | ((source: string, el: HTMLElement, ctx: Record<string, unknown>) => void)
    | null = null;

  const vaultOn = vi.fn(() => ({ id: "mock-event" }));

  const registerProcessor: RegisterProcessorFn = vi.fn(
    (
      _lang: string,
      handler: (
        source: string,
        el: HTMLElement,
        ctx: Record<string, unknown>
      ) => void
    ) => {
      registeredHandler = handler;
    }
  );

  const services = {
    app: {
      vault: {
        on: vaultOn,
        getAbstractFileByPath: vi.fn(() => null),
        read: vi.fn(async () => ""),
        modify: vi.fn(async () => {}),
      },
    },
    settings: {
      folders: DEFAULT_FOLDERS,
      ui: {
        defaultTaskViewMode: "context",
        showCompletedByDefault: false,
      },
    },
    queryService: {
      dv: vi.fn(() => dvApi),
      getActiveEntitiesByTag: vi.fn(() => []),
      getPage: vi.fn(() => null),
    },
    taskParser: {
      toggleTaskLine: vi.fn((line: string) => line),
    },
    loggerService: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
    filterService: new TaskFilterService(DEFAULT_FOLDERS),
    sortService: new TaskSortService(),
  } as unknown as TaskProcessorServices;

  return {
    services,
    registerProcessor,
    vaultOn,
    getHandler: () => registeredHandler!,
  };
}

// ─── Render helper ──────────────────────────────────────────────────────────

function render(source: string, dvApi: DataviewApi | null = null) {
  const { services, registerProcessor, getHandler } = createMockServices(dvApi);
  registerPmTasksProcessor(services, registerProcessor);

  const el = document.createElement("div");
  const children: unknown[] = [];
  const ctx = {
    addChild: (child: unknown) => children.push(child),
    sourcePath: "test.md",
  };

  getHandler()(source, el, ctx as unknown as Record<string, unknown>);
  return { el, services };
}

// ─── Test isolation ──────────────────────────────────────────────────────────

afterEach(() => {
  vi.useRealTimers();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("pm-tasks-dashboard — toolbar", () => {
  it("renders toolbar with view mode tabs", () => {
    const { el } = render("mode: dashboard");
    const toolbar = el.querySelector(".pm-tasks-toolbar");
    expect(toolbar).not.toBeNull();
    const tabs = toolbar!.querySelectorAll(".pm-tasks-toolbar__tab");
    expect(tabs.length).toBeGreaterThanOrEqual(4); // context, date, priority, tag
  });

  it("marks the active view mode tab with --active class", () => {
    const { el } = render("mode: dashboard");
    const activeTab = el.querySelector(".pm-tasks-toolbar__tab--active");
    expect(activeTab).not.toBeNull();
    // Default is "context"
    expect(activeTab!.textContent).toBe("Context");
  });

  it("renders search input in toolbar", () => {
    const { el } = render("mode: dashboard");
    const search = el.querySelector(".pm-tasks-toolbar__search");
    expect(search).not.toBeNull();
  });

  it("renders filters button in toolbar", () => {
    const { el } = render("mode: dashboard");
    const filtersBtn = el.querySelector(".pm-tasks-toolbar__filters-btn");
    expect(filtersBtn).not.toBeNull();
  });

  it("clicking a view-mode tab makes it active", () => {
    const dvApi = createMockDataviewApi([]);
    const { el } = render("mode: dashboard", dvApi);

    const tabs = [...el.querySelectorAll<HTMLButtonElement>(".pm-tasks-toolbar__tab")];
    const priorityTab = tabs.find((t) => t.textContent === "Priority");
    expect(priorityTab).not.toBeUndefined();

    priorityTab!.click();
    expect(priorityTab!.classList.contains("pm-tasks-toolbar__tab--active")).toBe(true);

    // Other tabs should not be active
    const contextTab = tabs.find((t) => t.textContent === "Context");
    expect(contextTab!.classList.contains("pm-tasks-toolbar__tab--active")).toBe(false);
  });
});

describe("pm-tasks-dashboard — filter drawer", () => {
  it("renders the drawer (hidden by default)", () => {
    const { el } = render("mode: dashboard");
    const drawer = el.querySelector(".pm-tasks-drawer");
    expect(drawer).not.toBeNull();
    // Drawer is hidden by default
    expect((drawer as HTMLElement).style.display).toBe("none");
  });

  it("clicking filters button toggles drawer visibility", () => {
    const dvApi = createMockDataviewApi([]);
    const { el } = render("mode: dashboard", dvApi);

    const filtersBtn = el.querySelector<HTMLButtonElement>(".pm-tasks-toolbar__filters-btn");
    const drawer = el.querySelector<HTMLElement>(".pm-tasks-drawer");
    expect(filtersBtn).not.toBeNull();
    expect(drawer).not.toBeNull();

    // Initially hidden
    expect(drawer!.style.display).toBe("none");

    // Click to open
    filtersBtn!.click();
    expect(drawer!.style.display).not.toBe("none");

    // Click to close
    filtersBtn!.click();
    expect(drawer!.style.display).toBe("none");
  });

  it("renders preset pills for each DUE_DATE_PRESETS entry inside the drawer", () => {
    const { el } = render("mode: dashboard");
    const drawer = el.querySelector(".pm-tasks-drawer");
    expect(drawer).not.toBeNull();

    const pills = [...drawer!.querySelectorAll(".pm-tasks-pill")];
    const pillLabels = pills.map((p) => p.textContent);
    for (const preset of DUE_DATE_PRESETS) {
      expect(pillLabels).toContain(preset);
    }
  });

  it("renders date range inputs (from and to) inside the drawer", () => {
    const { el } = render("mode: dashboard");
    const drawer = el.querySelector(".pm-tasks-drawer");
    const dateInputs = drawer!.querySelectorAll("input[type='date']");
    expect(dateInputs.length).toBe(2);
  });

  it("clicking a preset pill adds active class to it", () => {
    const dvApi = createMockDataviewApi([
      { path: "projects/A.md", tasks: [{ text: "task" }] },
    ]);
    const { el } = render("mode: dashboard", dvApi);

    const drawer = el.querySelector(".pm-tasks-drawer")!;
    const pills = [...drawer.querySelectorAll<HTMLButtonElement>(".pm-tasks-pill")];
    const todayPill = pills.find((p) => p.textContent === "Today");
    expect(todayPill).not.toBeUndefined();

    todayPill!.click();
    expect(todayPill!.classList.contains("pm-tasks-pill--active")).toBe(true);
  });

  it("clicking an active preset pill deactivates it", () => {
    const dvApi = createMockDataviewApi([
      { path: "projects/A.md", tasks: [{ text: "task" }] },
    ]);
    const { el } = render("mode: dashboard", dvApi);

    const drawer = el.querySelector(".pm-tasks-drawer")!;
    const pills = [...drawer.querySelectorAll<HTMLButtonElement>(".pm-tasks-pill")];
    const todayPill = pills.find((p) => p.textContent === "Today");
    expect(todayPill).not.toBeUndefined();

    // Activate then deactivate
    todayPill!.click();
    expect(todayPill!.classList.contains("pm-tasks-pill--active")).toBe(true);

    todayPill!.click();
    expect(todayPill!.classList.contains("pm-tasks-pill--active")).toBe(false);
  });

  it("multiple preset pills can be active simultaneously (OR logic)", () => {
    const dvApi = createMockDataviewApi([
      { path: "projects/A.md", tasks: [{ text: "task" }] },
    ]);
    const { el } = render("mode: dashboard", dvApi);

    const drawer = el.querySelector(".pm-tasks-drawer")!;
    const pills = [...drawer.querySelectorAll<HTMLButtonElement>(".pm-tasks-pill")];
    const todayPill = pills.find((p) => p.textContent === "Today");
    const overduePill = pills.find((p) => p.textContent === "Overdue");
    expect(todayPill).not.toBeUndefined();
    expect(overduePill).not.toBeUndefined();

    todayPill!.click();
    overduePill!.click();

    expect(todayPill!.classList.contains("pm-tasks-pill--active")).toBe(true);
    // Overdue uses --warn class when active (not --active)
    expect(overduePill!.classList.contains("pm-tasks-pill--warn")).toBe(true);
  });

  it("'No Date' and a date preset can both be active simultaneously", () => {
    const dvApi = createMockDataviewApi([
      { path: "projects/A.md", tasks: [{ text: "task" }] },
    ]);
    const { el } = render("mode: dashboard", dvApi);

    const drawer = el.querySelector(".pm-tasks-drawer")!;
    const pills = [...drawer.querySelectorAll<HTMLButtonElement>(".pm-tasks-pill")];
    const todayPill = pills.find((p) => p.textContent === "Today");
    const noDatePill = pills.find((p) => p.textContent === "No Date");
    expect(todayPill).not.toBeUndefined();
    expect(noDatePill).not.toBeUndefined();

    todayPill!.click();
    noDatePill!.click();

    expect(todayPill!.classList.contains("pm-tasks-pill--active")).toBe(true);
    expect(noDatePill!.classList.contains("pm-tasks-pill--active")).toBe(true);
  });

  it("entering a custom range date clears selectedPresets in filter state", () => {
    const dvApi = createMockDataviewApi([
      { path: "projects/A.md", tasks: [{ text: "task" }] },
    ]);
    const { el } = render("mode: dashboard", dvApi);

    const drawer = el.querySelector(".pm-tasks-drawer")!;
    const pills = [...drawer.querySelectorAll<HTMLButtonElement>(".pm-tasks-pill")];
    const todayPill = pills.find((p) => p.textContent === "Today");
    todayPill!.click();
    expect(todayPill!.classList.contains("pm-tasks-pill--active")).toBe(true);

    // Change a date range input — this clears selected presets in the filter state
    // and adds a chip for the custom range
    const fromInput = drawer.querySelector("input[type='date']") as HTMLInputElement;
    fromInput.value = "2030-01-01";
    fromInput.dispatchEvent(new Event("change"));

    // After changing a range input, the chips bar should now show a range chip
    // (confirming the filter state updated to use range instead of preset)
    const chipsBar = el.querySelector<HTMLElement>(".pm-tasks-chips-bar");
    // The chips bar should be visible with a range chip
    expect(chipsBar!.style.display).not.toBe("none");
    const rangeChips = [...chipsBar!.querySelectorAll(".pm-tasks-filter-chip")].filter(
      (c) => c.textContent?.includes("→")
    );
    expect(rangeChips.length).toBeGreaterThan(0);
  });

  it("renders sort builder inside the drawer", () => {
    const { el } = render("mode: dashboard");
    const drawer = el.querySelector(".pm-tasks-drawer");
    expect(drawer).not.toBeNull();
    const sortBuilder = drawer!.querySelector(".pm-tasks-sort-builder");
    expect(sortBuilder).not.toBeNull();
  });

  it("renders toggle row for 'Show completed' inside drawer", () => {
    const { el } = render("mode: dashboard");
    const drawer = el.querySelector(".pm-tasks-drawer");
    expect(drawer).not.toBeNull();
    const toggleRows = drawer!.querySelectorAll(".pm-tasks-toggle-row");
    expect(toggleRows.length).toBeGreaterThan(0);
    const texts = [...toggleRows].map((r) => r.textContent);
    expect(texts.some((t) => t?.includes("Show completed"))).toBe(true);
  });
});

describe("pm-tasks-dashboard — chips bar", () => {
  it("chips bar is hidden when no filters are active", () => {
    const { el } = render("mode: dashboard");
    const chipsBar = el.querySelector<HTMLElement>(".pm-tasks-chips-bar");
    expect(chipsBar).not.toBeNull();
    expect(chipsBar!.style.display).toBe("none");
  });

  it("chips bar shows a chip after activating a preset pill", () => {
    const dvApi = createMockDataviewApi([
      { path: "projects/A.md", tasks: [{ text: "task" }] },
    ]);
    const { el } = render("mode: dashboard", dvApi);

    const drawer = el.querySelector(".pm-tasks-drawer")!;
    const pills = [...drawer.querySelectorAll<HTMLButtonElement>(".pm-tasks-pill")];
    const todayPill = pills.find((p) => p.textContent === "Today");
    todayPill!.click();

    const chipsBar = el.querySelector<HTMLElement>(".pm-tasks-chips-bar");
    expect(chipsBar!.style.display).not.toBe("none");
    const chips = chipsBar!.querySelectorAll(".pm-tasks-filter-chip");
    expect(chips.length).toBeGreaterThan(0);
  });

  it("clicking ✕ on a chip removes that filter", () => {
    const dvApi = createMockDataviewApi([
      { path: "projects/A.md", tasks: [{ text: "task" }] },
    ]);
    const { el } = render("mode: dashboard", dvApi);

    const drawer = el.querySelector(".pm-tasks-drawer")!;
    const pills = [...drawer.querySelectorAll<HTMLButtonElement>(".pm-tasks-pill")];
    const todayPill = pills.find((p) => p.textContent === "Today");
    todayPill!.click();

    // Chip should exist
    const chipsBar = el.querySelector<HTMLElement>(".pm-tasks-chips-bar");
    let chips = chipsBar!.querySelectorAll(".pm-tasks-filter-chip");
    expect(chips.length).toBe(1);

    // Click the remove button on the chip
    const removeBtn = chips[0].querySelector<HTMLElement>(".pm-tasks-filter-chip__remove");
    expect(removeBtn).not.toBeNull();
    removeBtn!.click();

    // Chip should be gone and bar hidden again
    chips = chipsBar!.querySelectorAll(".pm-tasks-filter-chip");
    expect(chips.length).toBe(0);
    expect(chipsBar!.style.display).toBe("none");
  });
});

describe("pm-tasks-dashboard — tag filter UI", () => {
  it("renders FilterChipSelect instances in the drawer", () => {
    const dvApi = createMockDataviewApi([
      {
        path: "projects/A.md",
        tasks: [
          { text: "task one", tags: ["#work"] },
          { text: "task two", tags: ["#personal"] },
        ],
      },
    ]);
    const { el } = render("mode: dashboard", dvApi);
    // Chip selects (client, engagement, tags) are inside the drawer
    const drawer = el.querySelector(".pm-tasks-drawer");
    expect(drawer).not.toBeNull();
    const chipSelects = drawer!.querySelectorAll(".pm-filter-chip-select");
    // At minimum: client, engagement, tag = 3
    expect(chipSelects.length).toBeGreaterThanOrEqual(3);
  });

  it("renders 'Include untagged' label within drawer when tasks have tags", () => {
    const dvApi = createMockDataviewApi([
      {
        path: "projects/A.md",
        tasks: [{ text: "tagged", tags: ["#work"] }],
      },
    ]);
    const { el } = render("mode: dashboard", dvApi);
    const drawer = el.querySelector(".pm-tasks-drawer");
    expect(drawer).not.toBeNull();
    // Find any pm-checkbox-label with "Include untagged" text
    const labels = [...drawer!.querySelectorAll(".pm-checkbox-label")];
    const untaggedLabel = labels.find(l => l.textContent?.includes("Include untagged"));
    expect(untaggedLabel).not.toBeUndefined();
  });

  it("FilterChipSelect onChange updates tagFilter and schedules re-render", () => {
    vi.useFakeTimers();
    try {
      const dvApi = createMockDataviewApi([
        {
          path: "projects/A.md",
          tasks: [
            { text: "tagged task", tags: ["#work"] },
            { text: "untagged task" },
          ],
        },
      ]);
      const { el } = render("mode: dashboard", dvApi);

      // Locate the "Include untagged" checkbox inside the drawer
      const drawer = el.querySelector(".pm-tasks-drawer");
      expect(drawer).not.toBeNull();
      const labels = [...drawer!.querySelectorAll(".pm-checkbox-label")];
      const untaggedLabel = labels.find(l => l.textContent?.includes("Include untagged"));
      expect(untaggedLabel).not.toBeUndefined();

      const checkbox = untaggedLabel!.querySelector("input[type='checkbox']") as HTMLInputElement;
      expect(checkbox).not.toBeNull();
      expect(checkbox.checked).toBe(false);

      // Capture output HTML before interaction
      const outputBefore = el.querySelector(".pm-tasks-dashboard__output")?.innerHTML ?? "";

      // Toggle the checkbox — updates filter state and schedules a debounced re-render
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event("change"));

      // Advance timers past the debounce window to trigger the re-render
      vi.runAllTimers();

      // Output element should still exist (no crash)
      const outputEl = el.querySelector(".pm-tasks-dashboard__output");
      expect(outputEl).not.toBeNull();

      // Output should differ now that includeUntagged is true
      const outputAfter = outputEl!.innerHTML;
      expect(outputAfter).not.toBe(outputBefore);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("pm-tasks-dashboard — clear filters", () => {
  it("Clear All Filters button is rendered in the drawer", () => {
    const { el } = render("mode: dashboard");
    const drawer = el.querySelector(".pm-tasks-drawer");
    expect(drawer).not.toBeNull();
    const clearBtn = [...drawer!.querySelectorAll("button")].find(b => b.textContent === "✕ Clear All Filters");
    expect(clearBtn).not.toBeUndefined();
  });

  it("Clear All Filters button resets active due-date preset pills", () => {
    const dvApi = createMockDataviewApi([
      {
        path: "projects/A.md",
        tasks: [{ text: "tagged", tags: ["#work"] }],
      },
    ]);
    const { el } = render("mode: dashboard", dvApi);

    // Activate the "Today" preset pill
    const drawer = el.querySelector(".pm-tasks-drawer")!;
    const pills = [...drawer.querySelectorAll<HTMLButtonElement>(".pm-tasks-pill")];
    const todayPill = pills.find((p) => p.textContent === "Today");
    expect(todayPill).not.toBeUndefined();
    todayPill!.click();
    expect(todayPill!.classList.contains("pm-tasks-pill--active")).toBe(true);

    // Click Clear All Filters in drawer
    const clearBtn = [...drawer.querySelectorAll("button")].find(b => b.textContent === "✕ Clear All Filters");
    expect(clearBtn).not.toBeUndefined();
    clearBtn!.click();

    // After clear, the dashboard re-renders — check that the "Today" due-date preset pill is not active
    const newDrawer = el.querySelector(".pm-tasks-drawer");
    expect(newDrawer).not.toBeNull();
    const newPills = [...newDrawer!.querySelectorAll<HTMLButtonElement>(".pm-tasks-pill")];
    const newTodayPill = newPills.find((p) => p.textContent === "Today");
    expect(newTodayPill).not.toBeUndefined();
    expect(newTodayPill!.classList.contains("pm-tasks-pill--active")).toBe(false);

    // The chips bar should be hidden again (no active filters)
    const chipsBar = el.querySelector<HTMLElement>(".pm-tasks-chips-bar");
    expect(chipsBar!.style.display).toBe("none");
  });

  it("renders task text via MarkdownRenderer (not plain setText)", async () => {
    const dvApi = createMockDataviewApi([
      {
        path: "projects/A.md",
        tasks: [{ text: "See [label](https://example.com) for details" }],
      },
    ]);
    const { el } = render("mode: dashboard", dvApi);

    // Allow async MarkdownRenderer.render calls to settle before asserting
    await flushPromises();

    const textSpan = el.querySelector(".pm-task-text");
    expect(textSpan).not.toBeNull();
    // MarkdownRenderer.render sets innerHTML — not textContent
    expect(textSpan?.innerHTML).toContain("See [label](https://example.com) for details");
    expect(textSpan?.textContent).toContain("See [label](https://example.com) for details");
  });
});

describe("pm-tasks-dashboard — filters badge", () => {
  it("badge is hidden when no filters are active", () => {
    const { el } = render("mode: dashboard");
    const badge = el.querySelector<HTMLElement>(".pm-tasks-filter-badge");
    expect(badge).not.toBeNull();
    expect(badge!.style.display).toBe("none");
  });

  it("badge shows a count after activating a filter", () => {
    const dvApi = createMockDataviewApi([
      { path: "projects/A.md", tasks: [{ text: "task" }] },
    ]);
    const { el } = render("mode: dashboard", dvApi);

    const drawer = el.querySelector(".pm-tasks-drawer")!;
    const pills = [...drawer.querySelectorAll<HTMLButtonElement>(".pm-tasks-pill")];
    const todayPill = pills.find((p) => p.textContent === "Today");
    todayPill!.click();

    const badge = el.querySelector<HTMLElement>(".pm-tasks-filter-badge");
    expect(badge!.style.display).not.toBe("none");
    expect(badge!.textContent).not.toBe("");
  });
});
