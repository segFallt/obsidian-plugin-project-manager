import type { DashboardFilters, DataviewTask } from "../types";
import type { ITaskSortService } from "../services/interfaces";
import type { TaskListRenderer } from "./task-list-renderer";

/**
 * Read-only, precomputed lookups plus rendering collaborators a view renderer
 * draws from. The host (dashboard / shell) resolves all data up front so the
 * renderers stay read-pure — no Dataview or query-service access.
 */
export interface TaskRenderHelpers {
  sortService: ITaskSortService;
  taskRenderer: TaskListRenderer;
  /** task file path → context bucket, for grouping and sorting. */
  contextMap: Map<string, string>;
  /** task file path → file mtime, for sorting. */
  mtimeMap: Map<string, number>;
  /**
   * task file path → its constructed parent (project / recurring-meeting) path,
   * or null when the task nests under its own file. Carries an entry for every
   * task, including ones whose parent page does not exist (the path is built
   * from front-matter without an existence check — preserve that lazy semantic).
   */
  parentPathMap: Map<string, string | null>;
  /** file path → display name, with the raw path already substituted for a missing page. */
  nameMap: Map<string, string>;
}

/** A patch an interactive renderer emits to change filter state. */
export type FilterPatch = Partial<DashboardFilters>;

/** Everything a renderer needs for one render pass. No dv / query access. */
export interface ViewRenderContext<TItem, THelpers = TaskRenderHelpers> {
  container: HTMLElement;
  /** Items already filtered by the host. */
  items: TItem[];
  filters: DashboardFilters;
  /** Interactive renderers push filter changes through this; passive ones never call it. */
  onFilterChange: (patch: FilterPatch) => void;
  helpers: THelpers;
}

/** A dashboard view renderer: draws items into a container from its context alone. */
export interface IViewRenderer<TItem, THelpers = TaskRenderHelpers> {
  readonly mode: string;
  /**
   * The single filter facet an interactive renderer drives (e.g. the RAID
   * matrix's cell). Passive renderers declare none; the shell uses it to feed
   * such a renderer counts filtered by all OTHER facets.
   */
  readonly ownsFacet?: string;
  render(ctx: ViewRenderContext<TItem, THelpers>): void | Promise<void>;
}

export type TaskViewRenderer = IViewRenderer<DataviewTask>;
