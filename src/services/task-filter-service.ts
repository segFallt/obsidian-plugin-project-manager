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
import type { IQueryService, ITaskFilterService } from "./interfaces";

/**
 * Pure filtering logic for the task dashboard and by-project views.
 *
 * All methods are free of DOM side-effects — they accept data and return
 * filtered arrays. This makes them straightforward to unit-test.
 */
export class TaskFilterService implements ITaskFilterService {
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
      filtered = filtered.filter((t) => f.contextFilter.includes(getTaskContext(t)));
    }

    if (f.searchText) {
      filtered = filtered.filter((t) => t.text.toLowerCase().includes(f.searchText));
    }

    if (f.dueDateFilter && f.dueDateFilter !== "All") {
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
        this.matchesEngagementFilter(t, f.engagementFilter, f.includeUnassignedEngagements, dv)
      );
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
        if (getTaskContext(t) !== "Project") return true;
        const page = dv.page(t.path);
        return page !== null && f.projectStatusFilter.includes(String(page.status) as ProjectStatus);
      });
    }

    if (f.inboxStatusFilter !== "All") {
      filtered = filtered.filter((t) => {
        if (getTaskContext(t) !== "Inbox") return true;
        const page = dv.page(t.path);
        if (!page) return true;
        const isActive = page.status !== "Complete";
        return f.inboxStatusFilter === "Active" ? isActive : !isActive;
      });
    }

    if (f.meetingDateFilter !== "All") {
      filtered = filtered.filter((t) => {
        if (getTaskContext(t) !== "Meeting") return true;
        const page = dv.page(t.path);
        if (!page?.date) return f.meetingDateFilter === "All";
        return this.matchesMeetingDateFilter(String(page.date), f.meetingDateFilter);
      });
    }

    return filtered;
  }

  /** Returns true if the task's due date matches the given filter. */
  matchesDueDateFilter(task: DataviewTask, filter: DueDateFilter): boolean {
    const today = todayISO();
    const weekEnd = addDays(today, 7);
    const due = task.due ? String(task.due).substring(0, 10) : null;

    switch (filter) {
      case "Today":
        return due === today;
      case "This Week":
        return due !== null && due >= today && due <= weekEnd;
      case "Overdue":
        return due !== null && due < today;
      case "No Date":
        return due === null;
      default:
        return true;
    }
  }

  /** Returns true if an ISO date string matches the meeting date filter. */
  matchesMeetingDateFilter(dateStr: string, filter: MeetingDateFilter): boolean {
    const today = todayISO();
    const weekEnd = addDays(today, 7);
    const d = dateStr.substring(0, 10);

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
        const parentProject = dv.page(`projects/${parentProjectName}`);
        if (parentProject) {
          taskClient = normalizeToName(parentProject.client);
          if (!taskClient && parentProject.engagement) {
            taskClient = queryService.getClientFromEngagementLink(parentProject.engagement);
          }
        }
      }
    }

    if (includeUnassigned && !taskClient) return true;
    if (clientFilter.length === 0) return includeUnassigned ? !taskClient : false;
    return taskClient !== null && clientFilter.includes(taskClient);
  }

  /**
   * Returns true if a task belongs to one of the specified engagements.
   * Traverses the project → engagement chain when the file has no direct engagement.
   */
  matchesEngagementFilter(
    task: DataviewTask,
    engagementFilter: string[],
    includeUnassigned: boolean,
    dv: DataviewApi
  ): boolean {
    if (engagementFilter.length === 0 && !includeUnassigned) return true;

    const page = dv.page(task.path);
    if (!page) return false;

    let taskEngagement = normalizeToName(page.engagement);

    // Try parent project chain
    if (!taskEngagement && page.relatedProject) {
      const parentProjectName = normalizeToName(page.relatedProject);
      if (parentProjectName) {
        const parentProject = dv.page(`projects/${parentProjectName}`);
        if (parentProject) {
          taskEngagement = normalizeToName(parentProject.engagement);
        }
      }
    }

    if (includeUnassigned && !taskEngagement) return true;
    if (engagementFilter.length === 0) return includeUnassigned ? !taskEngagement : false;
    return taskEngagement !== null && engagementFilter.includes(taskEngagement);
  }

  // ─── Inbox-status helper (typed for test convenience) ────────────────────

  /** Returns true if a task page's status matches the inbox status filter. */
  matchesInboxStatusFilter(pageStatus: unknown, filter: InboxStatusFilter): boolean {
    if (filter === "All") return true;
    const isActive = String(pageStatus) !== "Complete";
    return filter === "Active" ? isActive : !isActive;
  }
}
