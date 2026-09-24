/**
 * DOM helper utilities shared by pm-tasks view components.
 */
import { CSS_CLS, CSS_VAR, HTML_TAG, DOM_ATTR, DOM_EVENT } from "../constants";

/**
 * Creates a `<select>` element populated with options.
 * @param container — Parent element to append the select to
 * @param values    — Ordered list of option values
 * @param labels    — Optional map of value → display text; falls back to the value itself
 */
export function createSelect(
  container: HTMLElement,
  values: string[],
  labels: Record<string, string>
): HTMLSelectElement {
  const select = container.createEl("select", { cls: "pm-tasks-filter-select dropdown" });
  for (const v of values) {
    select.createEl("option", { text: labels[v] ?? v, value: v });
  }
  return select;
}

/**
 * Wraps content in a `<details>` / `<summary>` collapsible section.
 */
export function renderCollapsible(
  container: HTMLElement,
  title: string,
  renderFn: (inner: HTMLElement) => void
): void {
  const details = container.createEl("details", { cls: "pm-filter-section" });
  details.createEl("summary", { text: title, cls: "pm-filter-section__title" });
  const inner = details.createDiv({ cls: "pm-filter-section__content" });
  renderFn(inner);
}

/** Options for {@link createInternalLink}. */
export interface CreateInternalLinkOptions {
  /**
   * Custom click handler. When provided, the helper calls `preventDefault()`
   * before invoking it, so navigation can be routed explicitly.
   */
  onClick?: (event: MouseEvent) => void;
}

/**
 * Creates an Obsidian internal-link anchor and appends it to `parent`.
 *
 * Link text is set via `textContent` (never `innerHTML`), so file names
 * containing `<`, `>`, or `&` are rendered as literal text rather than markup.
 *
 * @param parent — Element the anchor is appended to
 * @param path   — Target note path, used for both `data-href` and `href`
 * @param text   — Display text for the link
 * @param opts   — Optional behaviour, e.g. a custom `onClick` handler
 */
export function createInternalLink(
  parent: HTMLElement,
  path: string,
  text: string,
  opts?: CreateInternalLinkOptions
): HTMLAnchorElement {
  const link = document.createElement(HTML_TAG.ANCHOR);
  link.className = CSS_CLS.INTERNAL_LINK;
  link.textContent = text;
  link.setAttribute(DOM_ATTR.DATA_HREF, path);
  link.setAttribute(DOM_ATTR.HREF, path);

  const onClick = opts?.onClick;
  if (onClick) {
    link.addEventListener(DOM_EVENT.CLICK, (event) => {
      event.preventDefault();
      onClick(event);
    });
  }

  parent.appendChild(link);
  return link;
}

/**
 * Wraps a CSS custom-property token name in a `var()` reference, e.g.
 * `--pm-entity-client` → `var(--pm-entity-client)`, for use as an inline style
 * value that resolves against the theme's token layer.
 */
export function cssVar(token: string): string {
  return `var(${token})`;
}

/**
 * Renders a styled error message into the given container.
 * @param padding — Optional CSS padding value applied to the error element
 */
export function renderError(container: HTMLElement, message: string, padding?: string): void {
  const div = container.createDiv({ cls: CSS_CLS.PM_ERROR });
  div.style.color = CSS_VAR.TEXT_ERROR;
  if (padding !== undefined) {
    div.style.padding = padding;
  }
  div.textContent = message;
}
