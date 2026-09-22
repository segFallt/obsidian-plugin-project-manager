import { ItemView } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import { DEBOUNCE_MS } from "../constants";
import { debounced } from "../utils/debounce";
import type { ViewState, ViewStateStore } from "./view-state-store";
import type { DashboardViewComponent, PersistState } from "./dashboard-render-child";

/** Config for a note-less, side-panel-hosted dashboard. */
export interface DashboardItemViewConfig {
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
 *
 * Since Obsidian 1.7.2 the {@link ItemView} base constructor calls
 * `this.getViewType()` while `super()` runs, before any subclass field or
 * parameter property is assigned. The view-identity getters are therefore
 * abstract: each concrete host implements them from module constants that read
 * no post-`super()` state, so construction never touches `this.config`.
 */
export abstract class DashboardItemViewHost extends ItemView {
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

  abstract getViewType(): string;

  abstract getDisplayText(): string;

  abstract getIcon(): string;

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
