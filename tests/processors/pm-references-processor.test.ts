import { describe, it, expect, vi } from "vitest";
import * as ObsidianModule from "obsidian";
import { registerPmReferencesProcessor } from "@/processors/pm-references-processor";
import type { ReferenceProcessorServices } from "@/plugin-context";
import { createMockDataviewApi } from "../mocks/dataview-mock";
import type { MockPageData } from "../mocks/dataview-mock";

// ─── Reference page factory ───────────────────────────────────────────────────

function makeReferencePage(overrides: Partial<{ name: string; topics: unknown[] }>): MockPageData {
  const name = overrides.name ?? "My Reference";
  return {
    path: `reference/references/${name}.md`,
    name,
    tags: ["#reference"],
    frontmatter: { topics: overrides.topics ?? [] },
  };
}

// ─── Mock services factory ────────────────────────────────────────────────────

function createMockServices(references: MockPageData[] = []) {
  let registeredHandler:
    | ((source: string, el: HTMLElement, ctx: { addChild: (c: { render(): void }) => void; sourcePath: string }) => void)
    | null = null;

  const mockPlugin = {
    registerMarkdownCodeBlockProcessor: vi.fn(
      (_lang: string, handler: (source: string, el: HTMLElement, ctx: { addChild: (c: unknown) => void; sourcePath: string }) => void) => {
        registeredHandler = handler as typeof registeredHandler;
      }
    ),
  };

  const dv = createMockDataviewApi(references);

  const services: ReferenceProcessorServices = {
    app: {} as unknown as ReferenceProcessorServices["app"],
    settings: {
      ui: {
        referenceDashboardFilters: {} as Record<string, unknown>,
      },
    } as unknown as ReferenceProcessorServices["settings"],
    queryService: {
      dv: vi.fn(() => dv),
    } as unknown as ReferenceProcessorServices["queryService"],
    hierarchyService: {} as unknown as ReferenceProcessorServices["hierarchyService"],
    navigationService: {} as unknown as ReferenceProcessorServices["navigationService"],
    loggerService: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as ReferenceProcessorServices["loggerService"],
    commandExecutor: {
      executeCommandById: vi.fn(),
    } as unknown as ReferenceProcessorServices["commandExecutor"],
    actionContext: {} as unknown as ReferenceProcessorServices["actionContext"],
    saveSettings: vi.fn(async () => undefined),
  };

  return { mockPlugin, services, getHandler: () => registeredHandler! };
}

// ─── Render helper ────────────────────────────────────────────────────────────

function render(source: string, references: MockPageData[] = []) {
  const mock = createMockServices(references);
  registerPmReferencesProcessor(
    mock.mockPlugin as unknown as import("obsidian").Plugin,
    mock.services
  );

  const el = document.createElement("div");
  const children: unknown[] = [];
  const ctx = { addChild: (child: unknown) => children.push(child), sourcePath: "dashboard/references.md" };

  mock.getHandler()(source, el, ctx);
  return {
    el,
    services: mock.services,
    saveSettings: mock.services.saveSettings as ReturnType<typeof vi.fn>,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("pm-references processor (summary card)", () => {
  it("registers a 'pm-references' code block processor", () => {
    const mock = createMockServices();
    registerPmReferencesProcessor(mock.mockPlugin as unknown as import("obsidian").Plugin, mock.services);
    expect(mock.mockPlugin.registerMarkdownCodeBlockProcessor).toHaveBeenCalledWith(
      "pm-references",
      expect.any(Function)
    );
  });

  it("renders a summary card container with the expected CSS class", () => {
    const { el } = render("");
    expect(el.querySelector(".pm-references-summary")).not.toBeNull();
  });

  it("renders the 'Reference Dashboard' heading", () => {
    const { el } = render("");
    const heading = el.querySelector("h3");
    expect(heading?.textContent).toBe("Reference Dashboard");
  });

  it("renders reference count text for 0 references", () => {
    const { el } = render("", []);
    expect(el.querySelector("p")?.textContent).toBe("0 references in your vault");
  });

  it("renders reference count text for 1 reference (singular)", () => {
    const { el } = render("", [makeReferencePage({ name: "Ref A" })]);
    expect(el.querySelector("p")?.textContent).toBe("1 reference in your vault");
  });

  it("renders reference count text for multiple references", () => {
    const refs = [makeReferencePage({ name: "A" }), makeReferencePage({ name: "B" })];
    const { el } = render("", refs);
    expect(el.querySelector("p")?.textContent).toBe("2 references in your vault");
  });

  it("renders an 'Open Dashboard →' button", () => {
    const { el } = render("");
    const btn = el.querySelector("button");
    expect(btn?.textContent).toBe("Open Dashboard →");
  });

  it("button has the expected CSS classes", () => {
    const { el } = render("");
    const btn = el.querySelector("button")!;
    expect(btn.classList.contains("pm-references-summary__open-btn")).toBe(true);
    expect(btn.classList.contains("mod-cta")).toBe(true);
  });

  it("clicking the button executes the open-reference-dashboard command", () => {
    const { el, services } = render("");
    (el.querySelector("button") as HTMLButtonElement).click();
    expect(services.commandExecutor.executeCommandById as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      "open-reference-dashboard"
    );
  });

  it("parses valid YAML config without errors", () => {
    const { el } = render("viewMode: topic");
    expect(el.querySelector(".pm-references-summary")).not.toBeNull();
    expect(el.querySelector(".pm-error")).toBeNull();
  });

  it("renders error state for invalid YAML, not the summary card", () => {
    const spy = vi.spyOn(ObsidianModule, "parseYaml").mockImplementationOnce(() => {
      throw new Error("bad YAML");
    });
    try {
      const { el } = render("bad: yaml: content");
      expect(el.querySelector(".pm-references-summary")).toBeNull();
      expect(el.querySelector(".pm-error")).not.toBeNull();
    } finally {
      spy.mockRestore();
    }
  });

  it("counts only references matching the config topic filter", () => {
    const refs = [
      makeReferencePage({ name: "Ref1", topics: ["[[Technology]]"] }),
      makeReferencePage({ name: "Ref2", topics: ["[[Design]]"] }),
    ];
    const source = "filter:\n  topics:\n    - Technology";
    const { el } = render(source, refs);
    expect(el.querySelector("p")?.textContent).toBe("1 reference in your vault");
  });

  it("counts all references when no topic filter is set", () => {
    const refs = [
      makeReferencePage({ name: "Ref1", topics: ["[[Technology]]"] }),
      makeReferencePage({ name: "Ref2", topics: ["[[Design]]"] }),
    ];
    const { el } = render("viewMode: topic", refs);
    expect(el.querySelector("p")?.textContent).toBe("2 references in your vault");
  });

  it("button click with filter.topics sets selectedNode via the store, then executes command", async () => {
    const refs = [makeReferencePage({ name: "Ref1", topics: ["[[Technology]]"] })];
    const source = "filter:\n  topics:\n    - \"[[Technology]]\"";
    const { el, services, saveSettings } = render(source, refs);

    (el.querySelector("button") as HTMLButtonElement).click();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect((services.settings.ui.referenceDashboardFilters as Record<string, unknown>).selectedNode).toBe("Technology");
    expect(saveSettings).toHaveBeenCalledOnce();
    expect(services.commandExecutor.executeCommandById as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      "open-reference-dashboard"
    );
    const saveOrder = saveSettings.mock.invocationCallOrder[0];
    const cmdOrder = (services.commandExecutor.executeCommandById as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(cmdOrder);
  });

  it("button click with no filter.topics does not mutate selectedNode and still executes command", () => {
    const { el, services, saveSettings } = render("viewMode: topic");
    (el.querySelector("button") as HTMLButtonElement).click();

    expect((services.settings.ui.referenceDashboardFilters as Record<string, unknown>).selectedNode).toBeUndefined();
    expect(saveSettings).not.toHaveBeenCalled();
    expect(services.commandExecutor.executeCommandById as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
      "open-reference-dashboard"
    );
  });

  it("normalises a wikilink topic name to a plain name when setting selectedNode", async () => {
    const source = "filter:\n  topics:\n    - \"[[Technology]]\"";
    const { el, services } = render(source, [makeReferencePage({ name: "Ref1", topics: ["[[Technology]]"] })]);

    (el.querySelector("button") as HTMLButtonElement).click();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect((services.settings.ui.referenceDashboardFilters as Record<string, unknown>).selectedNode).toBe("Technology");
  });
});
