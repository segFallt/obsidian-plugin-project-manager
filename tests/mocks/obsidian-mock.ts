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
  setTitle(_title: string) { return this; }
}

export class SuggestModal<T> extends Modal {
  constructor(app: App) {
    super(app);
  }

  getItems(): T[] { return []; }
  getItemText(_item: T): string { return ""; }
  onChooseItem(_item: T, _evt: MouseEvent | KeyboardEvent): void {}
  renderSuggestion(_item: T, _el: HTMLElement): void {}
  setPlaceholder(_placeholder: string) { return this; }
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
  setName(_name: string) { return this; }
  setDesc(_desc: string) { return this; }
  addText(_cb: (text: unknown) => void) { return this; }
  addTextArea(_cb: (text: unknown) => void) { return this; }
  addToggle(_cb: (toggle: unknown) => void) { return this; }
  addButton(_cb: (button: unknown) => void) { return this; }
  addDropdown(_cb: (dd: unknown) => void) { return this; }
}

// ─── Plugin stub ─────────────────────────────────────────────────────────────

export class Plugin {
  app: App;
  manifest = { id: "project-manager", name: "Project Manager", version: "0.1.0" };

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
  loadData(): Promise<unknown> { return Promise.resolve(null); }
  saveData(_data: unknown): Promise<void> { return Promise.resolve(); }
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
    on: (_event: string, _handler: (...args: unknown[]) => void): EventRef => ({ id: "mock-event" }),
    off: (_event: string, _handler: (...args: unknown[]) => void) => {},
  };

  metadataCache = {
    getFileCache: (_file: TFile): { frontmatter?: Record<string, unknown>; tags?: Array<{ tag: string }> } | null => null,
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
