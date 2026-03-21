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
import { CONTEXT, STATUS, WEEK_DAYS, ISO_DATE_LENGTH } from "../constants";
import type { FolderSettings } from "../settings";
import type { IQueryService, ITaskFilterService } from "./interfaces";

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
    queryService: IQueryService
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
        this.matchesClientFilter(t, f.clientFilter, f.includeUnassignedClients, dv, queryService)
      );
    }

    if (f.engagementFilter.length > 0 || f.includeUnassignedEngagements) {
      filtered = filtered.filter((t) =>
        this.matchesEngagementFilter(t, f.engagementFilter, f.includeUnassignedEngagements, queryService)
      );
    }

    if ((f.tagFilter?.length ?? 0) > 0 || f.includeUntagged) {
      filtered = filtered.filter((t) => this.matchesTagFilter(t, f.tagFilter ?? [], f.includeUntagged ?? false));
    }

    if (f.viewMode === "context") {
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
      const tomorrow = addDays(today, 1);
      const weekEnd = addDays(today, WEEK_DAYS);
      const nextWeekStart = addDays(today, WEEK_DAYS + 1);
      const nextWeekEnd = addDays(today, WEEK_DAYS * 2);

      for (const preset of filter.selectedPresets) {
        if (preset === "No Date") continue; // handled above
        let matches = false;
        switch (preset) {
          case "Today":
            matches = due === today;
            break;
          case "Tomorrow":
            matches = due === tomorrow;
            break;
          case "This Week":
            matches = due >= today && due <= weekEnd;
            break;
          case "Next Week":
            matches = due >= nextWeekStart && due <= nextWeekEnd;
            break;
          case "Overdue":
            matches = due < today;
            break;
        }
        if (matches) return true;
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

    switch (filter) {
      case "Today":
        return d === today;
      case "This Week":
        return d >= today && d <= weekEnd;
      case "Past":
        return d < today;
      default:
        return true;
    }
  }

  /**
   * Returns true if a task belongs to one of the specified clients.
   * Traverses the engagement → client chain when the file has no direct client.
   */
  matchesClientFilter(
    task: DataviewTask,
    clientFilter: string[],
    includeUnassigned: boolean,
    dv: DataviewApi,
    queryService: IQueryService
  ): boolean {
    if (clientFilter.length === 0 && !includeUnassigned) return true;

    const page = dv.page(task.path);
    if (!page) return false;

    let taskClient = normalizeToName(page.client);

    // Try engagement chain
    if (!taskClient && page.engagement) {
      taskClient = queryService.getClientFromEngagementLink(page.engagement);
    }

    // Try parent project chain
    if (!taskClient && page.relatedProject) {
      const parentProjectName = normalizeToName(page.relatedProject);
      if (parentProjectName) {
        const parentProject = dv.page(`${this.folders.projects}/${parentProjectName}`);
        if (parentProject) {
          taskClient = normalizeToName(parentProject.client);
          if (!taskClient && parentProject.engagement) {
            taskClient = queryService.getClientFromEngagementLink(parentProject.engagement);
          }
        }
      }
    }

    // Try parent recurring meeting chain
    if (!taskClient && page["recurring-meeting"]) {
      const meetingEngagement = queryService.getEngagementNameForPath(task.path);
      if (meetingEngagement) {
        taskClient = queryService.getClientFromEngagementLink(meetingEngagement);
      }
    }

    if (includeUnassigned && !taskClient) return true;
    if (clientFilter.length === 0) return includeUnassigned ? !taskClient : false;
    return taskClient !== null && clientFilter.includes(taskClient);
  }

  /**
   * Returns true if a task belongs to one of the specified engagements.
   * Delegates all traversal (direct engagement, project note, recurring meeting
   * event) to queryService.getEngagementNameForPath.
   */
  matchesEngagementFilter(
    task: DataviewTask,
    engagementFilter: string[],
    includeUnassigned: boolean,
    queryService: IQueryService
  ): boolean {
    if (engagementFilter.length === 0 && !includeUnassigned) return true;

    const taskEngagement = queryService.getEngagementNameForPath(task.path);

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
