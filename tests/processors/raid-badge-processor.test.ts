import { describe, it, expect, vi } from "vitest";
import { registerRaidBadgePostProcessor } from "@/processors/raid-badge-processor";
import { TFile } from "../mocks/obsidian-mock";
import type { App, Plugin } from "obsidian";

// ─── Mock plugin factory ────────────────────────────────────────────────────

function createMockPlugin(frontmatter: Record<string, unknown> = {}) {
  let registeredHandler: ((el: HTMLElement) => void) | null = null;

  const mockApp = {
    vault: {
      getAbstractFileByPath: vi.fn(() => null),
    },
    metadataCache: {
      getFileCache: vi.fn(() => ({ frontmatter })),
    },
  } as unknown as App;

  const mockPlugin = {
    app: mockApp,
    registerMarkdownPostProcessor: vi.fn((handler: (el: HTMLElement) => void) => {
      registeredHandler = handler;
    }),
  } as unknown as Plugin & { app: App };

  return {
    mockPlugin,
    getHandler: () => registeredHandler!,
  };
}

// ─── Helper to build an element with a text node + optional link ──────────

function buildEl(annotationText: string, linkHref?: string): HTMLElement {
  const container = document.createElement("p");

  // Text node containing the annotation
  const textNode = document.createTextNode(annotationText);
  container.appendChild(textNode);

  // Optionally add an internal-link anchor after the text
  if (linkHref) {
    const link = document.createElement("a");
    link.className = "internal-link";
    link.setAttribute("data-href", linkHref);
    link.setAttribute("href", linkHref);
    link.textContent = linkHref.replace(/\.md$/, "");
    container.appendChild(link);
  }

  return container;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("raid-badge post processor", () => {
  it("registers a markdown post processor", () => {
    const { mockPlugin } = createMockPlugin();
    registerRaidBadgePostProcessor(mockPlugin);
    expect(mockPlugin.registerMarkdownPostProcessor).toHaveBeenCalledWith(expect.any(Function), 100);
  });

  it("{raid:positive}[[Item]] is replaced with .raid-badge--positive span", () => {
    const { mockPlugin, getHandler } = createMockPlugin();
    registerRaidBadgePostProcessor(mockPlugin);

    const el = buildEl("{raid:positive}", "My Risk.md");
    getHandler()(el);

    const badge = el.querySelector(".raid-badge--positive");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("↑");
  });

  it("{raid:negative}[[Item]] is replaced with .raid-badge--negative span", () => {
    const { mockPlugin, getHandler } = createMockPlugin();
    registerRaidBadgePostProcessor(mockPlugin);

    const el = buildEl("{raid:negative}", "My Issue.md");
    getHandler()(el);

    const badge = el.querySelector(".raid-badge--negative");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("↓");
  });

  it("{raid:neutral}[[Item]] is replaced with .raid-badge--neutral span", () => {
    const { mockPlugin, getHandler } = createMockPlugin();
    registerRaidBadgePostProcessor(mockPlugin);

    const el = buildEl("{raid:neutral}", "My Decision.md");
    getHandler()(el);

    const badge = el.querySelector(".raid-badge--neutral");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("·");
  });

  it("text node without {raid:...} is left unchanged", () => {
    const { mockPlugin, getHandler } = createMockPlugin();
    registerRaidBadgePostProcessor(mockPlugin);

    const el = document.createElement("p");
    el.textContent = "No annotation here [[SomeLink]]";

    getHandler()(el);

    // No badge should appear
    expect(el.querySelector(".raid-badge")).toBeNull();
    // Text should be unchanged
    expect(el.textContent).toBe("No annotation here [[SomeLink]]");
  });

  it("uses specific label from raid-type frontmatter when available", () => {
    const { mockPlugin, getHandler } = createMockPlugin({ "raid-type": "Risk" });

    // Make vault find the file — must be a TFile instance to pass instanceof check
    (mockPlugin.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(
      new TFile("raid/Payment Risk.md")
    );

    registerRaidBadgePostProcessor(mockPlugin);

    const el = buildEl("{raid:positive}", "raid/Payment Risk.md");
    getHandler()(el);

    const badge = el.querySelector(".raid-badge--positive");
    expect(badge).not.toBeNull();
    // "Risk" + "positive" → "Mitigates"
    expect(badge?.textContent).toContain("Mitigates");
  });

  it("falls back to generic label when vault file exists but has no raid-type frontmatter", () => {
    // getFileCache returns a frontmatter object without a raid-type key
    const { mockPlugin, getHandler } = createMockPlugin({});

    // Vault finds the file, but frontmatter is empty (no raid-type)
    (mockPlugin.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(
      new TFile("raid/Unknown.md")
    );

    registerRaidBadgePostProcessor(mockPlugin);

    const el = buildEl("{raid:positive}", "raid/Unknown.md");
    getHandler()(el);

    const badge = el.querySelector(".raid-badge--positive");
    expect(badge).not.toBeNull();
    // No raid-type → generic fallback
    expect(badge?.textContent).toContain("Supports");
  });

  it("falls back to generic label when vault file not found", () => {
    const { mockPlugin, getHandler } = createMockPlugin({});

    // getAbstractFileByPath returns null (file not found)
    (mockPlugin.app.vault.getAbstractFileByPath as ReturnType<typeof vi.fn>).mockReturnValue(null);

    registerRaidBadgePostProcessor(mockPlugin);

    const el = buildEl("{raid:positive}", "NonExistent.md");
    getHandler()(el);

    const badge = el.querySelector(".raid-badge--positive");
    expect(badge).not.toBeNull();
    // Generic positive fallback
    expect(badge?.textContent).toContain("Supports");
  });

  it("continues processing remaining nodes when one annotation throws", () => {
    const { mockPlugin, getHandler } = createMockPlugin();
    registerRaidBadgePostProcessor(mockPlugin);

    const el = document.createElement("p");
    el.appendChild(document.createTextNode("{raid:positive}"));
    el.appendChild(document.createTextNode("{raid:negative}"));

    // Force document.createElement("span") to throw on the first call so the first
    // annotation node fails, leaving the second to be processed by the error-isolating loop.
    const origCreate = document.createElement.bind(document);
    let spanCallCount = 0;
    vi.spyOn(document, "createElement").mockImplementation((tag: string, ...args: unknown[]) => {
      if (tag === "span" && spanCallCount++ === 0) {
        throw new Error("simulated badge creation failure");
      }
      return origCreate(tag, ...(args as []));
    });

    expect(() => getHandler()(el)).not.toThrow();
    // Second node must still produce a badge despite the first throwing
    const badge = el.querySelector(".raid-badge--negative");
    expect(badge).not.toBeNull();

    vi.restoreAllMocks();
  });

  it("transforms annotation embedded mid-sentence in a single text node", () => {
    const { mockPlugin, getHandler } = createMockPlugin();
    registerRaidBadgePostProcessor(mockPlugin);

    // Single text node with the annotation embedded in sentence text — models
    // how Obsidian renders a line before wikilink resolution splits the node
    const el = document.createElement("p");
    el.appendChild(document.createTextNode("Meeting note {raid:positive}"));
    // link follows as a sibling (already resolved by Obsidian)
    const link = document.createElement("a");
    link.className = "internal-link";
    link.setAttribute("data-href", "My Risk.md");
    el.appendChild(link);
    el.appendChild(document.createTextNode(" for context."));

    getHandler()(el);

    const badge = el.querySelector(".raid-badge--positive");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("↑");
    // Original {raid:...} token must not appear as text
    expect(el.textContent).not.toContain("{raid:positive}");
    // Surrounding text is preserved
    expect(el.textContent).toContain("Meeting note");
    expect(el.textContent).toContain("for context.");
  });

  it("preserves text before and after the annotation", () => {
    const { mockPlugin, getHandler } = createMockPlugin();
    registerRaidBadgePostProcessor(mockPlugin);

    const el = document.createElement("p");
    // Text with annotation embedded
    el.appendChild(document.createTextNode("See also "));
    el.appendChild(document.createTextNode("{raid:neutral}"));
    const link = document.createElement("a");
    link.className = "internal-link";
    link.textContent = "Some Decision";
    link.setAttribute("data-href", "Some Decision.md");
    el.appendChild(link);
    el.appendChild(document.createTextNode(" for context."));

    getHandler()(el);

    const badge = el.querySelector(".raid-badge--neutral");
    expect(badge).not.toBeNull();
    // The surrounding text should still be present
    expect(el.textContent).toContain("See also");
    expect(el.textContent).toContain("for context.");
  });
});
