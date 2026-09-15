import type { IEntityQuery } from "../services/entity-query";
import type { FilterSpec, FilterState } from "../services/filter-engine";
import { FilterEngine } from "../services/filter-engine";
import type { DashboardFilters } from "../types";
import { HTML_TAG } from "../constants";
import type { IViewRenderer, ViewRenderContext } from "./view-renderer";

/**
 * Everything the generic dashboard shell needs to run one render pass, supplied
 * by a consumer (e.g. pm-tasks). Each callback is deliberately narrow so the
 * shell stays entity-agnostic: it never touches Dataview, the vault, or any
 * task-specific type — the consumer captures those in the closures it passes.
 */
export interface DashboardShellDeps<TItem, THelpers> {
  /** Reads the entity's base item set (unfiltered). */
  query: IEntityQuery<TItem>;
  /** View renderers keyed by view-mode string. */
  views: Record<string, IViewRenderer<TItem, THelpers>>;
  /** The active view mode; selects which renderer draws. */
  getViewMode: () => string;
  /** The current filter model handed to the chosen renderer's context. */
  getFilters: () => DashboardFilters;
  /** Builds the static facet catalog to filter with. */
  buildSpec: () => FilterSpec<TItem>;
  /** Builds the dynamic selection state to filter with. */
  buildState: () => FilterState;
  /** Precomputes the read-only render helpers from the filtered item set. */
  buildHelpers: (items: TItem[]) => THelpers;
  /** An interactive renderer emits filter patches through this. */
  onFilterChange: (patch: Partial<DashboardFilters>) => void;
  /** Text shown when nothing matches the current filters. */
  emptyMessage: string;
  /** Draws the fallback when the active view mode has no registered renderer. */
  onUnknownMode: (outputEl: HTMLElement, mode: string) => void;
}

/**
 * ─── Generic dashboard data-flow orchestrator ───────────────────────────────
 *
 * A lifecycle-free POJO (no Obsidian imports, unit-testable without a vault)
 * that owns ONLY the resolve → filter → empty-check → helpers → dispatch flow
 * shared by every entity dashboard. All entity- and host-specific concerns
 * (filter UI, persistence, teardown, Dataview access) live in the consumer and
 * reach the shell exclusively through {@link DashboardShellDeps}.
 */
export class DashboardShell<TItem, THelpers> {
  constructor(private readonly deps: DashboardShellDeps<TItem, THelpers>) {}

  /** Resolves, filters, and renders the active view into `outputEl`. */
  async render(outputEl: HTMLElement): Promise<void> {
    const deps = this.deps;
    outputEl.empty();

    const items = deps.query.resolve();
    const state = deps.buildState();
    const spec = deps.buildSpec();
    const filtered = FilterEngine.apply(items, spec, state);

    if (filtered.length === 0) {
      outputEl.createEl(HTML_TAG.EM, { text: deps.emptyMessage });
      return;
    }

    const helpers = deps.buildHelpers(filtered);
    const mode = deps.getViewMode();
    const renderer = deps.views[mode];
    if (!renderer) {
      deps.onUnknownMode(outputEl, mode);
      return;
    }

    const ctx: ViewRenderContext<TItem, THelpers> = {
      container: outputEl,
      items: filtered,
      filters: deps.getFilters(),
      onFilterChange: deps.onFilterChange,
      helpers,
    };

    // Excluded-facet counts: an interactive renderer that drives a single facet
    // gets the item set filtered by ALL OTHER facets, so it can show counts that
    // ignore its own selection.
    if (renderer.ownsFacet) {
      ctx.facetItems = FilterEngine.apply(items, spec.specWithout(renderer.ownsFacet), state);
    }

    await renderer.render(ctx);
  }
}
