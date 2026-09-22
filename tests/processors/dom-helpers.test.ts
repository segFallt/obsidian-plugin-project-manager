import { describe, it, expect, vi } from "vitest";
import {
  createInternalLink,
  createSelect,
  renderCollapsible,
  renderError,
} from "@/processors/dom-helpers";
import { CSS_CLS } from "@/constants";

describe("createInternalLink", () => {
  it("builds an internal-link anchor with the standard class, data-href and href", () => {
    const parent = document.createElement("div");

    const link = createInternalLink(parent, "projects/Alpha.md", "Alpha");

    expect(parent.children).toHaveLength(1);
    expect(link.tagName).toBe("A");
    expect(link.classList.contains(CSS_CLS.INTERNAL_LINK)).toBe(true);
    expect(link.getAttribute("data-href")).toBe("projects/Alpha.md");
    expect(link.getAttribute("href")).toBe("projects/Alpha.md");
    expect(link.textContent).toBe("Alpha");
    expect(parent.firstChild).toBe(link);
  });

  it("sets link text via textContent so special characters cannot inject markup", () => {
    const parent = document.createElement("div");

    const link = createInternalLink(parent, "raid/A.md", "A<b>&c");

    // No child elements were parsed from the name — it is literal text.
    expect(link.children).toHaveLength(0);
    expect(link.querySelector("b")).toBeNull();
    expect(link.textContent).toBe("A<b>&c");
    // The escaped markup round-trips through innerHTML as entities, never a tag.
    expect(link.innerHTML).toBe("A&lt;b&gt;&amp;c");
  });

  it("invokes the optional onClick hook and prevents default navigation", () => {
    const parent = document.createElement("div");
    const onClick = vi.fn();

    const link = createInternalLink(parent, "notes/N.md", "N", { onClick });

    const event = new MouseEvent("click", { cancelable: true });
    link.dispatchEvent(event);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("attaches no click handler when onClick is omitted", () => {
    const parent = document.createElement("div");

    const link = createInternalLink(parent, "notes/N.md", "N");
    // Drop href so jsdom does not attempt (unimplemented) navigation on click.
    link.removeAttribute("href");

    const event = new MouseEvent("click", { cancelable: true });
    link.dispatchEvent(event);

    // The helper added no listener, so nothing prevented the default action.
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("createSelect", () => {
  it("creates a select with options, honouring the label map with a value fallback", () => {
    const container = document.createElement("div");

    const select = createSelect(container, ["a", "b"], { a: "Alpha" });

    const options = [...select.querySelectorAll("option")];
    expect(options).toHaveLength(2);
    expect(options[0].value).toBe("a");
    expect(options[0].textContent).toBe("Alpha");
    expect(options[1].textContent).toBe("b");
  });
});

describe("renderCollapsible", () => {
  it("renders a details/summary section and calls the render function with the inner element", () => {
    const container = document.createElement("div");
    const renderFn = vi.fn((inner: HTMLElement) => {
      inner.createSpan({ text: "body" });
    });

    renderCollapsible(container, "Title", renderFn);

    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.querySelector("summary")?.textContent).toBe("Title");
    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(details?.textContent).toContain("body");
  });
});

describe("renderError", () => {
  it("renders the message and applies optional padding", () => {
    const container = document.createElement("div");

    renderError(container, "Boom", "8px");

    const errorDiv = container.querySelector(`.${CSS_CLS.PM_ERROR}`) as HTMLElement;
    expect(errorDiv).not.toBeNull();
    expect(errorDiv.textContent).toBe("Boom");
    expect(errorDiv.style.padding).toBe("8px");
  });

  it("omits padding when not provided", () => {
    const container = document.createElement("div");

    renderError(container, "Boom");

    const errorDiv = container.querySelector(`.${CSS_CLS.PM_ERROR}`) as HTMLElement;
    expect(errorDiv.style.padding).toBe("");
  });
});
