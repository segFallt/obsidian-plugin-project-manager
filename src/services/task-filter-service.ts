import type {
  DataviewTask,
  DataviewApi,
  DashboardFilters,
  DueDateFilter,
  StartDateFilter,
  ScheduledDateFilter,
  MeetingDateFilter,
  InboxStatusFilter,
} from "../types";
import type { FolderSettings } from "../settings";
import type { IEntityHierarchyService, ITaskFilterService } from "./interfaces";
import { CONTEXT_FACET_KEYS } from "../constants";
import type { ContextFilterField } from "../constants";
import {
  FilterEngine,
  buildTaskFilterSpec,
  buildTaskFilterState,
  buildContextFilterState,
  createFilterSpec,
  dueDateMatches,
  startDateMatches,
  scheduledDateMatches,
  tagMatches,
  meetingDateMatches,
  inboxStatusMatches,
  clientMatches,
  engagementMatches,
  type TaskFacetDeps,
} from "./filter-engine";

/**
 * Pure filtering logic for the task dashboard and by-project views.
 *
 * The matching logic is decomposed into a generic, dependency-free
 * `FilterEngine` driven by a task `FilterSpec` (see `./filter-engine.ts`).
 * These public methods are thin adapters that build the spec/state and delegate
 * to the engine (aggregate methods) or to the shared per-facet matchers
 * (single-task predicates), keeping the API surface unchanged for callers.
 */
export class TaskFilterService implements ITaskFilterService {
  constructor(private readonly folders: FolderSettings) {}

  private deps(dv: DataviewApi, hierarchyService: IEntityHierarchyService): TaskFacetDeps {
    return { folders: this.folders, dv, hierarchyService };
  }

  /**
   * Applies all dashboard filters to a task list via the spec-driven engine.
   * Context-specific filters (project status, inbox status, meeting date) are
   * gated to "context" view mode by each facet's `appliesWhen`.
   */
  applyDashboardFilters(
    tasks: DataviewTask[],
    f: DashboardFilters,
    dv: DataviewApi,
    hierarchyService: IEntityHierarchyService
  ): DataviewTask[] {
    const spec = buildTaskFilterSpec(this.deps(dv, hierarchyService));
    const state = buildTaskFilterState(f);
    return FilterEngine.apply(tasks, spec, state);
  }

  /**
   * Applies context-specific filters (project status, inbox status, meeting date).
   * Only relevant when the dashboard is in "context" view mode. Runs the same
   * facets as `applyDashboardFilters` but restricted to the context sub-catalog.
   */
  applyContextSpecificFilters(
    tasks: DataviewTask[],
    f: Pick<DashboardFilters, ContextFilterField>,
    dv: DataviewApi
  ): DataviewTask[] {
    // Context facets need only folders + dv, so a null-object hierarchy service suffices.
    const noHierarchy: IEntityHierarchyService = {
      resolveClientName: () => null,
      resolveEngagementName: () => null,
    };
    const contextKeys = new Set<string>(CONTEXT_FACET_KEYS);
    const fullSpec = buildTaskFilterSpec(this.deps(dv, noHierarchy));
    const contextSpec = createFilterSpec(fullSpec.facets.filter((facet) => contextKeys.has(facet.key)));
    return FilterEngine.apply(tasks, contextSpec, buildContextFilterState(f));
  }

  /** Returns true if the task's due date matches the given filter (OR logic across presets). */
  matchesDueDateFilter(task: DataviewTask, filter: DueDateFilter): boolean {
    return dueDateMatches(task, filter);
  }

  /** Returns true if the task's start date matches the given filter (no-date preset or inclusive range). */
  matchesStartDateFilter(task: DataviewTask, filter: StartDateFilter): boolean {
    return startDateMatches(task, filter);
  }

  /** Returns true if the task's scheduled date matches the given filter (no-date preset or inclusive range). */
  matchesScheduledDateFilter(task: DataviewTask, filter: ScheduledDateFilter): boolean {
    return scheduledDateMatches(task, filter);
  }

  /** Returns true if the task matches the tag filter. */
  matchesTagFilter(task: DataviewTask, tagFilter: string[], includeUntagged: boolean): boolean {
    return tagMatches(task, tagFilter, includeUntagged);
  }

  /** Returns true if an ISO date string matches the meeting date filter. */
  matchesMeetingDateFilter(dateStr: string, filter: MeetingDateFilter): boolean {
    return meetingDateMatches(dateStr, filter);
  }

  /**
   * Returns true if a task belongs to one of the specified clients.
   * Covers direct page.client, engagement → client, relatedProject → project.engagement
   * → client, recurring-meeting-event → meeting.engagement → client, plus the
   * parent-project direct-client fallback.
   */
  matchesClientFilter(
    task: DataviewTask,
    clientFilter: string[],
    includeUnassigned: boolean,
    dv: DataviewApi,
    hierarchyService: IEntityHierarchyService
  ): boolean {
    return clientMatches(
      task,
      { names: clientFilter, includeUnassigned },
      this.deps(dv, hierarchyService)
    );
  }

  /**
   * Returns true if a task belongs to one of the specified engagements.
   * Delegates all traversal to hierarchyService.resolveEngagementName.
   */
  matchesEngagementFilter(
    task: DataviewTask,
    engagementFilter: string[],
    includeUnassigned: boolean,
    dv: DataviewApi,
    hierarchyService: IEntityHierarchyService
  ): boolean {
    return engagementMatches(
      task,
      { names: engagementFilter, includeUnassigned },
      this.deps(dv, hierarchyService)
    );
  }

  /** Returns true if a task page's status matches the inbox status filter. */
  matchesInboxStatusFilter(pageStatus: unknown, filter: InboxStatusFilter): boolean {
    return inboxStatusMatches(pageStatus, filter);
  }
}
