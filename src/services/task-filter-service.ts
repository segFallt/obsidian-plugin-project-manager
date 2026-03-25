import type {
  DataviewTask,
  DataviewApi,
  DashboardFilters,
  DueDateFilter,
  MeetingDateFilter,
  ProjectStatus,
  InboxStatusFilter,
} from "../types";
import { normalizeToName } from "../utils/link-utils";
import { todayISO } from "../utils/date-utils";
import { getTaskContext, getTaskPriority, addDays } from "../utils/task-utils";
import { CONTEXT, STATUS, WEEK_DAYS, ISO_DATE_LENGTH, VIEW_MODE, TOMORROW_OFFSET, NEXT_WEEK_START_OFFSET, NEXT_WEEK_END_OFFSET } from "../constants";
import type { FolderSettings } from "../settings";
import type { IEntityHierarchyService, ITaskFilterService } from "./interfaces";

/**
 * Pure filtering logic for the task dashboard and by-project views.
 *
 * All methods are free of DOM side-effects — they accept data and return
 * filtered arrays. This makes them straightforward to unit-test.
 */
export class TaskFilterService implements ITaskFilterService {
  constructor(private readonly folders: FolderSettings) {}

  /**
   * Applies all dashboard filters to a task list.
   * Context-specific filters (project status, inbox status, meeting date) are
   * applied only when viewMode is "context".
   */
  applyDashboardFilters(
    tasks: DataviewTask[],
    f: DashboardFilters,
    dv: DataviewApi,
    hierarchyService: IEntityHierarchyService
  ): DataviewTask[] {
    let filtered = tasks;

    if (!f.showCompleted) {
      filtered = filtered.filter((t) => !t.completed);
    }

    if (f.contextFilter.length > 0) {
      filtered = filtered.filter((t) => f.contextFilter.includes(getTaskContext(t, this.folders)));
    }

    if (f.searchText) {
      filtered = filtered.filter((t) => t.text.toLowerCase().includes(f.searchText));
    }

    if (this.isDueDateFilterActive(f.dueDateFilter)) {
      filtered = filtered.filter((t) => this.matchesDueDateFilter(t, f.dueDateFilter));
    }

    if (f.priorityFilter.length > 0) {
      filtered = filtered.filter((t) => f.priorityFilter.includes(getTaskPriority(t)));
    }

    if (f.clientFilter.length > 0 || f.includeUnassignedClients) {
      filtered = filtered.filter((t) =>
        this.matchesClientFilter(t, f.clientFilter, f.includeUnassignedClients, dv, hierarchyService)
      );
    }

    if (f.engagementFilter.length > 0 || f.includeUnassignedEngagements) {
      filtered = filtered.filter((t) =>
        this.matchesEngagementFilter(t, f.engagementFilter, f.includeUnassignedEngagements, dv, hierarchyService)
      );
    }

    if ((f.tagFilter?.length ?? 0) > 0 || f.includeUntagged) {
      filtered = filtered.filter((t) => this.matchesTagFilter(t, f.tagFilter ?? [], f.includeUntagged ?? false));
    }

    if (f.viewMode === VIEW_MODE.CONTEXT) {
      filtered = this.applyContextSpecificFilters(filtered, f, dv);
    }

    return filtered;
  }

  /**
   * Applies context-specific filters (project status, inbox status, meeting date).
   * Only relevant when the dashboard is in "context" view mode.
   */
  applyContextSpecificFilters(
    tasks: DataviewTask[],
    f: Pick<DashboardFilters, "projectStatusFilter" | "inboxStatusFilter" | "meetingDateFilter">,
    dv: DataviewApi
  ): DataviewTask[] {
    let filtered = tasks;

    if (f.projectStatusFilter.length > 0) {
      filtered = filtered.filter((t) => {
        if (getTaskContext(t, this.folders) !== CONTEXT.PROJECT) return true;
        const page = dv.page(t.path);
        return page !== null && f.projectStatusFilter.includes(String(page.status) as ProjectStatus);
      });
    }

    if (f.inboxStatusFilter !== "All") {
      filtered = filtered.filter((t) => {
        if (getTaskContext(t, this.folders) !== CONTEXT.INBOX) return true;
        const page = dv.page(t.path);
        if (!page) return true;
        const isActive = page.status !== STATUS.COMPLETE;
        return f.inboxStatusFilter === STATUS.ACTIVE ? isActive : !isActive;
      });
    }

    if (f.meetingDateFilter !== "All") {
      filtered = filtered.filter((t) => {
        const ctx = getTaskContext(t, this.folders);
        if (ctx !== CONTEXT.MEETING && ctx !== CONTEXT.RECURRING_MEETING) return true;
        const page = dv.page(t.path);
        if (!page?.date) return f.meetingDateFilter === "All";
        return this.matchesMeetingDateFilter(String(page.date), f.meetingDateFilter);
      });
    }

    return filtered;
  }

  /** Returns true if the task's due date matches the given filter (OR logic across presets). */
  matchesDueDateFilter(task: DataviewTask, filter: DueDateFilter): boolean {
    if (!this.isDueDateFilterActive(filter)) return true;

    const due = task.due ? String(task.due).substring(0, ISO_DATE_LENGTH) : null;

    // Tasks with no due date
    if (due === null) {
      return filter.selectedPresets.includes("No Date");
    }

    // Custom range check
    if (filter.rangeFrom !== null || filter.rangeTo !== null) {
      const inRange =
        (filter.rangeFrom === null || due >= filter.rangeFrom) &&
        (filter.rangeTo === null || due <= filter.rangeTo);
      if (inRange) return true;
    }

    // Preset OR logic — check each selected preset
    if (filter.selectedPresets.length > 0) {
      // Compute date boundaries once outside the loop (constant for this render cycle)
      const today = todayISO();
      const tomorrow = addDays(today, TOMORROW_OFFSET);
      const weekEnd = addDays(today, WEEK_DAYS);
      const nextWeekStart = addDays(today, NEXT_WEEK_START_OFFSET);
      const nextWeekEnd = addDays(today, NEXT_WEEK_END_OFFSET);

      const presetMatchers: Partial<Record<string, (d: string) => boolean>> = {
        "Today": (d) => d === today,
        "Tomorrow": (d) => d === tomorrow,
        "This Week": (d) => d >= today && d <= weekEnd,
        "Next Week": (d) => d >= nextWeekStart && d <= nextWeekEnd,
        "Overdue": (d) => d < today,
      };

      for (const preset of filter.selectedPresets) {
        if (preset === "No Date") continue; // handled above
        if (presetMatchers[preset]?.(due)) return true;
      }
    }

    return false;
  }

  private isDueDateFilterActive(filter: DueDateFilter): boolean {
    return filter.selectedPresets.length > 0 || filter.rangeFrom !== null || filter.rangeTo !== null;
  }

  /** Returns true if the task matches the tag filter. */
  matchesTagFilter(task: DataviewTask, tagFilter: string[], includeUntagged: boolean): boolean {
    if (tagFilter.length === 0 && !includeUntagged) return true; // no filter active

    const taskTags: string[] = task.tags ?? [];
    const isUntagged = taskTags.length === 0;

    if (isUntagged) return includeUntagged;
    return tagFilter.some(tag => taskTags.includes(tag));
  }

  /** Returns true if an ISO date string matches the meeting date filter. */
  matchesMeetingDateFilter(dateStr: string, filter: MeetingDateFilter): boolean {
    const today = todayISO();
    const weekEnd = addDays(today, WEEK_DAYS);
    const d = dateStr.substring(0, ISO_DATE_LENGTH);

    const meetingMatchers: Partial<Record<MeetingDateFilter, (s: string) => boolean>> = {
      "Today": (s) => s === today,
      "This Week": (s) => s >= today && s <= weekEnd,
      "Past": (s) => s < today,
    };

    return meetingMatchers[filter]?.(d) ?? true;
  }

  /**
   * Returns true if a task belongs to one of the specified clients.
   * Delegates all traversal chains to hierarchyService.resolveClientName, which
   * covers: direct page.client, engagement → client, relatedProject → project.engagement
   * → client, and recurring-meeting-event → meeting.engagement → client.
   *
   * Falls back to loading the parent project page directly to handle the edge case
   * where a project has a direct client field but no engagement.
   */
  matchesClientFilter(
    task: DataviewTask,
    clientFilter: string[],
    includeUnassigned: boolean,
    dv: DataviewApi,
    hierarchyService: IEntityHierarchyService
  ): boolean {
    if (clientFilter.length === 0 && !includeUnassigned) return true;

    const page = dv.page(task.path);
    if (!page) return false;

    let taskClient = hierarchyService.resolveClientName(page);

    // Edge-case fallback: project note whose parent project has a direct client
    // field but no engagement field (resolveClientName covers the engagement path;
    // this handles the client-only path on the parent project page).
    if (!taskClient && page.relatedProject) {
      const parentProjectName = normalizeToName(page.relatedProject);
      if (parentProjectName) {
        const parentProject = dv.page(`${this.folders.projects}/${parentProjectName}`);
        if (parentProject) {
          taskClient = hierarchyService.resolveClientName(parentProject);
        }
      }
    }

    if (includeUnassigned && !taskClient) return true;
    if (clientFilter.length === 0) return includeUnassigned ? !taskClient : false;
    return taskClient !== null && clientFilter.includes(taskClient);
  }

  /**
   * Returns true if a task belongs to one of the specified engagements.
   * Delegates all traversal (direct engagement, project note, recurring meeting
   * event) to hierarchyService.resolveEngagementName.
   */
  matchesEngagementFilter(
    task: DataviewTask,
    engagementFilter: string[],
    includeUnassigned: boolean,
    dv: DataviewApi,
    hierarchyService: IEntityHierarchyService
  ): boolean {
    if (engagementFilter.length === 0 && !includeUnassigned) return true;

    const page = dv.page(task.path);
    if (!page) return false;
    const taskEngagement = hierarchyService.resolveEngagementName(page);

    if (includeUnassigned && !taskEngagement) return true;
    if (engagementFilter.length === 0) return includeUnassigned ? !taskEngagement : false;
    return taskEngagement !== null && engagementFilter.includes(taskEngagement);
  }

  // ─── Inbox-status helper (typed for test convenience) ────────────────────

  /** Returns true if a task page's status matches the inbox status filter. */
  matchesInboxStatusFilter(pageStatus: unknown, filter: InboxStatusFilter): boolean {
    if (filter === "All") return true;
    const isActive = String(pageStatus) !== STATUS.COMPLETE;
    return filter === STATUS.ACTIVE ? isActive : !isActive;
  }
}
