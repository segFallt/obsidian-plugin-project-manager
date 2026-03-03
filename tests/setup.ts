// Global test setup for Vitest
// Runs before all test files

// Extend globalThis with browser APIs not available in Node/jsdom
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// ─── Obsidian HTMLElement extensions ────────────────────────────────────────
// Obsidian augments HTMLElement with convenience methods not present in jsdom.
// These polyfills enable tests for processors and modals that use these APIs.

interface ObsidianElOpts {
  text?: string;
  cls?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  href?: string;
  attr?: Record<string, string>;
}

declare global {
  interface HTMLElement {
    empty(): void;
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      opts?: ObsidianElOpts
    ): HTMLElementTagNameMap[K];
    createDiv(opts?: ObsidianElOpts): HTMLDivElement;
    createSpan(opts?: ObsidianElOpts): HTMLSpanElement;
    setText(text: string): void;
  }
}

HTMLElement.prototype.empty = function () {
  this.innerHTML = "";
};

HTMLElement.prototype.createEl = function (tag: string, opts?: ObsidianElOpts) {
  const el = document.createElement(tag);

  if (opts?.text != null) el.textContent = opts.text;

  if (opts?.cls) {
    for (const cls of opts.cls.split(" ")) {
      if (cls.trim()) el.classList.add(cls.trim());
    }
  }

  if (opts?.type) (el as HTMLInputElement).type = opts.type;
  if (opts?.placeholder) (el as HTMLInputElement).placeholder = opts.placeholder;
  // Use !== undefined so empty string ("") is also set correctly
  if (opts?.value !== undefined) {
    (el as HTMLInputElement).value = opts.value;
    el.setAttribute("value", opts.value);
  }
  if (opts?.href) (el as HTMLAnchorElement).href = opts.href;

  if (opts?.attr) {
    for (const [k, v] of Object.entries(opts.attr)) {
      el.setAttribute(k, v);
    }
  }

  this.appendChild(el);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return el as any;
};

HTMLElement.prototype.createDiv = function (opts?: ObsidianElOpts) {
  return this.createEl("div", opts);
};

HTMLElement.prototype.createSpan = function (opts?: ObsidianElOpts) {
  return this.createEl("span", opts);
};

HTMLElement.prototype.setText = function (text: string) {
  this.textContent = text;
};
