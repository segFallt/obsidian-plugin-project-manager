/**
 * Mock implementation of the `obsidian` module for use in Vitest tests.
 * Provides minimal stubs for the Obsidian API surface used by the plugin.
 */

// ─── TFile / TFolder stubs ─────────────────────────────────────────────────

export class TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
  parent: TFolder | null = null;
  stat = { mtime: Date.now(), ctime: Date.now(), size: 0 };

  constructor(path: string) {
    this.path = path;
    this.name = path.split("/").pop() ?? path;
    const dot = this.name.lastIndexOf(".");
    this.basename = dot === -1 ? this.name : this.name.substring(0, dot);
    this.extension = dot === -1 ? "" : this.name.substring(dot + 1);
  }
}

export class TFolder {
  path: string;
  name: string;
  children: Array<TFile | TFolder> = [];
  parent: TFolder | null = null;
  isRoot = () => this.path === "/";

  constructor(path: string) {
    this.path = path;
    this.name = path.split("/").pop() ?? path;
  }
}

export class TAbstractFile {
  path = "";
  name = "";
}

// ─── Notice stub ─────────────────────────────────────────────────────────────

export class Notice {
  constructor(
    public message: string,
    public timeout?: number
  ) {}
}

// ─── Modal stubs ─────────────────────────────────────────────────────────────

export class Modal {
  app: App;
  containerEl: HTMLElement;
  contentEl: HTMLElement;
  modalEl: HTMLElement;

  constructor(app: App) {
    this.app = app;
    this.containerEl = document.createElement("div");
    this.contentEl = document.createElement("div");
    this.modalEl = document.createElement("div");
    this.containerEl.appendChild(this.contentEl);
  }

  open() {}
  close() {}
  onOpen() {}
  onClose() {}
  setTitle(_title: string) {
    return this;
  }
}

export class SuggestModal<T> extends Modal {
  constructor(app: App) {
    super(app);
  }

  getItems(): T[] {
    return [];
  }
  getItemText(_item: T): string {
    return "";
  }
  onChooseItem(_item: T, _evt: MouseEvent | KeyboardEvent): void {}
  renderSuggestion(_item: T, _el: HTMLElement): void {}
  setPlaceholder(_placeholder: string) {
    return this;
  }
}

export class FuzzySuggestModal<T> extends SuggestModal<T> {
  constructor(app: App) {
    super(app);
  }
}

// ─── Setting stubs ────────────────────────────────────────────────────────────

export class PluginSettingTab {
  app: App;
  containerEl: HTMLElement;

  constructor(app: App, _plugin: unknown) {
    this.app = app;
    this.containerEl = document.createElement("div");
  }

  display() {}
  hide() {}
}

export class Setting {
  constructor(_containerEl: HTMLElement) {}
  setName(_name: string) {
    return this;
  }
  setDesc(_desc: string) {
    return this;
  }
  addText(_cb: (text: unknown) => void) {
    return this;
  }
  addTextArea(_cb: (text: unknown) => void) {
    return this;
  }
  addToggle(_cb: (toggle: unknown) => void) {
    return this;
  }
  addButton(_cb: (button: unknown) => void) {
    return this;
  }
  addDropdown(_cb: (dd: unknown) => void) {
    return this;
  }
}

// ─── Plugin stub ─────────────────────────────────────────────────────────────

export class Plugin {
  app: App;
  manifest = { id: "project-manager", name: "Project Manager", version: "0.1.4-beta.5" };

  constructor(app: App, manifest: unknown) {
    this.app = app;
    void manifest;
  }

  addCommand(_command: unknown) {}
  addSettingTab(_tab: unknown) {}
  registerMarkdownCodeBlockProcessor(
    _language: string,
    _handler: (source: string, el: HTMLElement, ctx: unknown) => void
  ) {}
  registerMarkdownPostProcessor(
    _handler: (el: HTMLElement, ctx: unknown) => void | Promise<void>
  ) {}
  loadData(): Promise<unknown> {
    return Promise.resolve(null);
  }
  saveData(_data: unknown): Promise<void> {
    return Promise.resolve();
  }
}

// ─── App stub ─────────────────────────────────────────────────────────────────

export class App {
  vault = {
    adapter: {
      exists: (_path: string) => Promise.resolve(false),
      getFullPath: (path: string) => path,
    },
    read: (_file: TFile) => Promise.resolve(""),
    create: (_path: string, _content: string) => Promise.resolve(new TFile(_path)),
    modify: (_file: TFile, _content: string) => Promise.resolve(),
    createFolder: (_path: string) => Promise.resolve(),
    getAbstractFileByPath: (_path: string): TFile | TFolder | null => null,
    getMarkdownFiles: () => [] as TFile[],
    delete: (_file: TFile) => Promise.resolve(),
    on: (_event: string, _handler: (...args: unknown[]) => void): EventRef => ({
      id: "mock-event",
    }),
    off: (_event: string, _handler: (...args: unknown[]) => void) => {},
  };

  metadataCache = {
    getFileCache: (
      _file: TFile
    ): { frontmatter?: Record<string, unknown>; tags?: Array<{ tag: string }> } | null => null,
  };

  fileManager = {
    processFrontMatter: (_file: TFile, _fn: (fm: Record<string, unknown>) => void) =>
      Promise.resolve(),
  };

  workspace = {
    getActiveFile: () => null as TFile | null,
    getLeaf: (_type: string) => ({
      openFile: (_file: TFile) => Promise.resolve(),
    }),
    onLayoutReady: (fn: () => void) => fn(),
  };

  plugins = {
    plugins: {} as Record<string, { api?: unknown }>,
    getPlugin: (_id: string) => null as null,
  };

  commands = {
    executeCommandById: (_id: string) => {},
  };
}

// ─── MarkdownRenderChild stub ─────────────────────────────────────────────────

export type EventRef = { id: string };

export class MarkdownRenderChild {
  containerEl: HTMLElement;

  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl;
  }

  onload() {}
  onunload() {}
  register(_cb: () => void) {}
  registerEvent(_eventRef: EventRef) {}
}

// ─── MarkdownRenderer stub ────────────────────────────────────────────────────

export class MarkdownRenderer {
  static async render(
    _app: unknown,
    markdown: string,
    el: HTMLElement,
    _sourcePath: string,
    _component: unknown
  ): Promise<void> {
    el.innerHTML = `<p>${markdown}</p>`;
  }
}

// ─── Suggest stubs ───────────────────────────────────────────────────────────

export class Scope {
  register() {}
  unregister() {}
}

export abstract class PopoverSuggest<T> {
  app: App;
  scope: Scope;

  constructor(app: App) {
    this.app = app;
    this.scope = new Scope();
  }

  abstract renderSuggestion(value: T, el: HTMLElement): void;
  abstract selectSuggestion(value: T, evt: MouseEvent | KeyboardEvent): void;

  open() {}
  close() {}
}

export abstract class AbstractInputSuggest<T> extends PopoverSuggest<T> {
  private textInputEl: HTMLInputElement;
  private containerEl: HTMLElement | null = null;
  private onSelectCallback: ((value: T, evt: MouseEvent | KeyboardEvent) => void) | null = null;
  limit = 100;

  constructor(app: App, textInputEl: HTMLInputElement) {
    super(app);
    this.textInputEl = textInputEl;
    textInputEl.addEventListener("focus", () => this.showSuggestions());
    textInputEl.addEventListener("input", () => this.showSuggestions());
  }

  abstract getSuggestions(query: string): T[] | Promise<T[]>;

  private showSuggestions(): void {
    const query = this.textInputEl.value;
    const result = this.getSuggestions(query);
    // Only handle synchronous results in the mock
    const items = Array.isArray(result) ? result : ([] as T[]);

    // Remove existing container
    if (this.containerEl) {
      this.containerEl.remove();
    }

    const container = document.createElement("div");
    container.className = "suggestion-container";

    for (const item of items) {
      const itemEl = document.createElement("div");
      itemEl.className = "suggestion-item";
      this.renderSuggestion(item, itemEl);
      itemEl.addEventListener("mousedown", (evt) => {
        evt.preventDefault();
        this.selectSuggestion(item, evt);
      });
      container.appendChild(itemEl);
    }

    // Append as sibling of input inside its parent
    this.textInputEl.parentElement?.appendChild(container);
    this.containerEl = container;
  }

  selectSuggestion(value: T, evt: MouseEvent | KeyboardEvent): void {
    if (this.onSelectCallback) {
      this.onSelectCallback(value, evt);
    }
    this.close();
  }

  open(): void {
    this.showSuggestions();
  }

  close(): void {
    if (this.containerEl) {
      this.containerEl.style.display = "none";
    }
  }

  setValue(value: string): this {
    this.textInputEl.value = value;
    return this;
  }

  getValue(): string {
    return this.textInputEl.value;
  }

  onSelect(callback: (value: T, evt: MouseEvent | KeyboardEvent) => void): this {
    this.onSelectCallback = callback;
    return this;
  }
}

// ─── parseYaml stub ───────────────────────────────────────────────────────────
// Simple YAML parser that handles the patterns used by this plugin's processors.

function parseScalar(value: string): unknown {
  const v = value.trim();
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null" || v === "~") return null;
  const num = Number(v);
  if (v !== "" && !isNaN(num)) return num;
  // Strip surrounding quotes
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function getIndent(line: string): number {
  return line.length - line.trimStart().length;
}

function parseArrayItem(lines: string[], start: number): { result: unknown; end: number } {
  const itemIndent = getIndent(lines[start]);
  const content = lines[start].trimStart().substring(2); // strip "- "
  const obj: Record<string, unknown> = {};

  const colonIdx = content.indexOf(":");
  if (colonIdx !== -1) {
    const k = content.substring(0, colonIdx).trim();
    const v = content.substring(colonIdx + 1).trim();
    if (v) obj[k] = parseScalar(v);
  }

  let i = start + 1;
  while (i < lines.length) {
    const propLine = lines[i];
    const propTrimmed = propLine.trimStart();
    if (!propTrimmed || propTrimmed.startsWith("#")) {
      i++;
      continue;
    }
    const propIndent = getIndent(propLine);
    if (propIndent <= itemIndent) break;
    const propColon = propTrimmed.indexOf(":");
    if (propColon !== -1) {
      const k = propTrimmed.substring(0, propColon).trim();
      const v = propTrimmed.substring(propColon + 1).trim();
      if (v) obj[k] = parseScalar(v);
    }
    i++;
  }
  return { result: obj, end: i };
}

function parseBlock(
  lines: string[],
  start: number,
  minIndent: number
): { result: Record<string, unknown>; end: number } {
  const result: Record<string, unknown> = {};
  let i = start;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trimStart();
    if (!trimmed || trimmed.startsWith("#")) {
      i++;
      continue;
    }

    const indent = getIndent(rawLine);
    if (indent < minIndent) break;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = trimmed.substring(0, colonIdx).trim();
    const rest = trimmed.substring(colonIdx + 1).trimStart();

    if (rest === "" || rest === "\r") {
      i++;
      if (i >= lines.length) {
        result[key] = null;
        continue;
      }
      const nextLine = lines[i];
      const nextTrimmed = nextLine.trimStart();
      const nextIndent = getIndent(nextLine);

      if (nextTrimmed.startsWith("- ")) {
        const arr: unknown[] = [];
        while (i < lines.length && lines[i].trimStart().startsWith("- ")) {
          const item = parseArrayItem(lines, i);
          arr.push(item.result);
          i = item.end;
        }
        result[key] = arr;
      } else if (nextIndent > indent) {
        const nested = parseBlock(lines, i, nextIndent);
        result[key] = nested.result;
        i = nested.end;
      } else {
        result[key] = null;
      }
    } else {
      result[key] = parseScalar(rest);
      i++;
    }
  }

  return { result, end: i };
}

export function parseYaml(text: string): unknown {
  if (!text || !text.trim()) return {};
  const lines = text.split("\n");
  return parseBlock(lines, 0, 0).result;
}
