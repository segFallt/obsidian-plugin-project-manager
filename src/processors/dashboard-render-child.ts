import { MarkdownRenderChild } from "obsidian";
import type { EventRef, TFile } from "obsidian";
import { DEBOUNCE_MS } from "../constants";
import { debounced } from "../utils/debounce";
import type { ViewState, ViewStateStore } from "./view-state-store";

/**
 * The mounted "view component" a dashboard host drives. Both the note-bound
 * {@link DashboardRenderChild} and the note-less {@link DashboardItemViewHost}
 * plug the same component (e.g. pm-tasks' `DashboardView`) into this seam:
 * render once, refresh on demand, tear down cleanly.
 */
export interface DashboardViewComponent {
  /** Mounts the view into its container. */
  render(): void;
  /** Re-runs the data-flow and repaints the output (filter UI is preserved). */
  refreshOutput(): void;
  /** Releases any timers / child components (must cancel pending refreshes). */
  destroy(): void;
}

/** Persists a subset of the view's state under a caller-chosen key. */
export type PersistState = (state: ViewState | null) => void;

/**
 * Builds a dashboard's view component when the host mounts. Receives a `persist`
 * callback (debounced, store-mediated), the container to mount into, and the
 * host itself as the Obsidian `Component` a markdown-rendering view registers under.
 */
export type DashboardViewFactory = (
  persist: PersistState,
  container: HTMLElement,
  component: MarkdownRenderChild
) => DashboardViewComponent;

/** Config for a note-bound, code-block-hosted dashboard. */
export interface DashboardRenderChildConfig {
  /** Builds the view component when the host mounts. */
  createView: DashboardViewFactory;
  /** Store consulted for own-write echo suppression and used for persistence. */
  store: ViewStateStore;
  /** Dot-path key the view's state is persisted under. */
  stateKey: string;
  /** Reads the persisted value at `stateKey` for a just-modified file. */
  readModifiedState: (file: TFile) => unknown;
  /** Registers a vault `modify` listener; returns the ref the child owns. */
  registerModify: (handler: (file: TFile) => void) => EventRef;
}

/**
 * Generic Obsidian host owning the lifecycle of a note-bound, code-block
 * dashboard. It knows nothing entity-specific: it forwards render/refresh to a
 * {@link DashboardViewComponent}, debounces auto-refresh on external vault
 * edits, and routes persistence through a {@link ViewStateStore}.
 *
 * Echo suppression: on a `modify` event it asks the store whether the file
 * carries this dashboard's own just-written value (`isOwnWrite`); if so it skips
 * the refresh (its own write-echo) and repaints only on external edits.
 */
export class DashboardRenderChild extends MarkdownRenderChild {
  private view: DashboardViewComponent | null = null;
  private pending: ViewState | null = null;
  private readonly autoRefresh = debounced(() => this.view?.refreshOutput(), DEBOUNCE_MS.TASKS);
  private readonly saveState = debounced(
    () => void this.config.store.save(this.config.stateKey, this.pending),
    DEBOUNCE_MS.PROPERTIES
  );

  constructor(
    containerEl: HTMLElement,
    private readonly config: DashboardRenderChildConfig
  ) {
    super(containerEl);
  }

  onload(): void {
    this.registerEvent(
      this.config.registerModify((file) => {
        // Skip our own write-echo; refresh on any other vault edit.
        if (this.config.store.isOwnWrite(file, this.config.readModifiedState(file))) return;
        this.autoRefresh.trigger();
      })
    );
  }

  onunload(): void {
    this.autoRefresh.cancel();
    this.saveState.cancel();
    this.view?.destroy();
    this.view = null;
  }

  render(): void {
    this.containerEl.empty();
    this.view = this.config.createView((state) => this.persist(state), this.containerEl, this);
    this.view.render();
  }

  /** Forwards an external refresh request to the mounted view. */
  refresh(): void {
    this.view?.refreshOutput();
  }

  private persist(state: ViewState | null): void {
    this.pending = state;
    this.saveState.trigger();
  }
}
