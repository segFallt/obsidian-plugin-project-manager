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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("pm-tasks-dashboard — due date filter UI", () => {
  it("renders preset buttons for each DUE_DATE_PRESETS entry", () => {
    const { el } = render("mode: dashboard");
    const buttons = el.querySelectorAll(".pm-date-preset-btn");
    expect(buttons.length).toBe(DUE_DATE_PRESETS.length);
    const labels = [...buttons].map(b => b.textContent);
    for (const preset of DUE_DATE_PRESETS) {
      expect(labels).toContain(preset);
    }
  });

  it("renders date range inputs (from and to)", () => {
    const { el } = render("mode: dashboard");
    const dateInputs = el.querySelectorAll("input[type='date']");
    expect(dateInputs.length).toBe(2);
  });

  it("renders 'or' separator between presets and range", () => {
    const { el } = render("mode: dashboard");
    const separator = el.querySelector(".pm-date-range-separator");
    expect(separator).not.toBeNull();
    expect(separator!.textContent).toContain("or");
  });

  it("clicking a preset button adds active class", () => {
    const dvApi = createMockDataviewApi([
      { path: "projects/A.md", tasks: [{ text: "task" }] },
    ]);
    const { el } = render("mode: dashboard", dvApi);
    const btn = el.querySelector(".pm-date-preset-btn") as HTMLButtonElement;
    expect(btn).not.toBeNull();

    btn.click();
    expect(btn.classList.contains("pm-date-preset-btn--active")).toBe(true);
  });

  it("clicking an active preset button deactivates it", () => {
    const dvApi = createMockDataviewApi([
      { path: "projects/A.md", tasks: [{ text: "task" }] },
    ]);
    const { el } = render("mode: dashboard", dvApi);
    const btn = el.querySelector(".pm-date-preset-btn") as HTMLButtonElement;

    // Activate then deactivate
    btn.click();
    expect(btn.classList.contains("pm-date-preset-btn--active")).toBe(true);
    btn.click();
    expect(btn.classList.contains("pm-date-preset-btn--active")).toBe(false);
  });

  it("entering a range date clears preset active states", () => {
    const dvApi = createMockDataviewApi([
      { path: "projects/A.md", tasks: [{ text: "task" }] },
    ]);
    const { el } = render("mode: dashboard", dvApi);

    // Activate a preset first
    const btn = el.querySelector(".pm-date-preset-btn") as HTMLButtonElement;
    btn.click();
    expect(btn.classList.contains("pm-date-preset-btn--active")).toBe(true);

    // Now change a date range input
    const fromInput = el.querySelector("input[type='date']") as HTMLInputElement;
    fromInput.value = "2030-01-01";
    fromInput.dispatchEvent(new Event("change"));

    // Preset should no longer be active
    expect(btn.classList.contains("pm-date-preset-btn--active")).toBe(false);
  });
});

describe("pm-tasks-dashboard — tag filter UI", () => {
  it("renders tag filter buttons when tasks have tags", () => {
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
    const tagBtns = el.querySelectorAll(".pm-tag-filter-btn");
    expect(tagBtns.length).toBe(2);
    const labels = [...tagBtns].map(b => b.textContent);
    expect(labels).toContain("#work");
    expect(labels).toContain("#personal");
  });

  it("does not render tag filter section when no tasks have tags", () => {
    const dvApi = createMockDataviewApi([
      {
        path: "projects/A.md",
        tasks: [{ text: "no tags" }],
      },
    ]);
    const { el } = render("mode: dashboard", dvApi);
    const tagBtns = el.querySelectorAll(".pm-tag-filter-btn");
    expect(tagBtns.length).toBe(0);
  });

  it("renders 'Include untagged' checkbox when tags exist", () => {
    const dvApi = createMockDataviewApi([
      {
        path: "projects/A.md",
        tasks: [{ text: "tagged", tags: ["#work"] }],
      },
    ]);
    const { el } = render("mode: dashboard", dvApi);
    const labels = [...el.querySelectorAll(".pm-filter-checkbox-label")];
    const untaggedLabel = labels.find(l => l.textContent?.includes("Include untagged"));
    expect(untaggedLabel).not.toBeUndefined();
  });

  it("clicking a tag button adds active class", () => {
    const dvApi = createMockDataviewApi([
      {
        path: "projects/A.md",
        tasks: [{ text: "tagged", tags: ["#work"] }],
      },
    ]);
    const { el } = render("mode: dashboard", dvApi);
    const btn = el.querySelector(".pm-tag-filter-btn") as HTMLButtonElement;
    expect(btn).not.toBeNull();

    btn.click();
    expect(btn.classList.contains("pm-tag-filter-btn--active")).toBe(true);
  });

  it("clicking an active tag button deactivates it", () => {
    const dvApi = createMockDataviewApi([
      {
        path: "projects/A.md",
        tasks: [{ text: "tagged", tags: ["#work"] }],
      },
    ]);
    const { el } = render("mode: dashboard", dvApi);
    const btn = el.querySelector(".pm-tag-filter-btn") as HTMLButtonElement;

    btn.click();
    expect(btn.classList.contains("pm-tag-filter-btn--active")).toBe(true);
    btn.click();
    expect(btn.classList.contains("pm-tag-filter-btn--active")).toBe(false);
  });

  it("toggling 'Include untagged' checkbox updates filter state and re-renders", () => {
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

      // Locate the "Include untagged" checkbox
      const labels = [...el.querySelectorAll(".pm-filter-checkbox-label")];
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
  it("Clear Filters button resets date preset and tag filter UI", () => {
    const dvApi = createMockDataviewApi([
      {
        path: "projects/A.md",
        tasks: [{ text: "tagged", tags: ["#work"] }],
      },
    ]);
    const { el } = render("mode: dashboard", dvApi);

    // Activate a preset
    const presetBtn = el.querySelector(".pm-date-preset-btn") as HTMLButtonElement;
    presetBtn.click();
    expect(presetBtn.classList.contains("pm-date-preset-btn--active")).toBe(true);

    // Click Clear Filters
    const clearBtn = [...el.querySelectorAll("button")].find(b => b.textContent === "Clear Filters");
    expect(clearBtn).not.toBeUndefined();
    clearBtn!.click();

    // After clear, the dashboard re-renders — check that no presets are active
    const activePresets = el.querySelectorAll(".pm-date-preset-btn--active");
    expect(activePresets.length).toBe(0);
  });

  it("renders collapsible Tag Filters section", () => {
    const { el } = render("mode: dashboard");
    const details = el.querySelectorAll("details");
    const summaryTexts = [...details].map(d => d.querySelector("summary")?.textContent ?? "");
    expect(summaryTexts).toContain("Tag Filters");
  });
});
