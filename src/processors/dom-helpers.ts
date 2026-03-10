/**
 * DOM helper utilities shared by pm-tasks view components.
 */
import { CSS_CLS, CSS_VAR } from "../constants";

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

/**
 * Renders a styled error message into the given container.
 */
export function renderError(container: HTMLElement, message: string): void {
  const div = container.createDiv({ cls: CSS_CLS.PM_ERROR });
  div.style.color = CSS_VAR.TEXT_ERROR;
  div.textContent = message;
}
