import { ItemView } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import { DEBOUNCE_MS } from "../constants";
import { debounced } from "../utils/debounce";
import type { ViewState, ViewStateStore } from "./view-state-store";
import type { DashboardViewComponent, PersistState } from "./dashboard-render-child";

/** Config for a note-less, side-panel-hosted dashboard. */
export interface DashboardItemViewConfig {
  /** Leaf view type identifier. */
  viewType: string;
  /** Tab / panel display title. */
  displayText: string;
  /** Ribbon / tab icon id. */
  icon: string;
  /** Store used for persistence (settings-backed for a note-less dashboard). */
  store: ViewStateStore;
  /** Dot-path key the view's state is persisted under. */
  stateKey: string;
  /** Builds the view component, mounting it into the supplied content element. */
  createView: (persist: PersistState, container: HTMLElement) => DashboardViewComponent;
}

/**
 * Generic Obsidian host owning the lifecycle of a note-less, side-panel
 * dashboard. It wraps the SAME {@link DashboardViewComponent} seam as
 * {@link DashboardRenderChild}, but drives it from `onOpen`/`onClose` and a
 * workspace leaf instead of a code block. Because it is settings-backed there is
 * no metadata-cache echo to suppress, so it registers no vault-modify listener.
 */
export class DashboardItemViewHost extends ItemView {
  private view: DashboardViewComponent | null = null;
  private pending: ViewState | null = null;
  private readonly saveState = debounced(
    () => void this.config.store.save(this.config.stateKey, this.pending),
    DEBOUNCE_MS.PROPERTIES
  );

  constructor(
    leaf: WorkspaceLeaf,
    private readonly config: DashboardItemViewConfig
  ) {
    super(leaf);
  }

  getViewType(): string {
    return this.config.viewType;
  }

  getDisplayText(): string {
    return this.config.displayText;
  }

  getIcon(): string {
    return this.config.icon;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async onOpen(): Promise<void> {
    this.view = this.config.createView((state) => this.persist(state), this.contentEl);
    this.view.render();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async onClose(): Promise<void> {
    this.saveState.cancel();
    this.view?.destroy();
    this.view = null;
    this.contentEl.empty();
  }

  private persist(state: ViewState | null): void {
    this.pending = state;
    this.saveState.trigger();
  }
}
