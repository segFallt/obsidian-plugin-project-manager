/**
 * Shared test fixture for the pm-tasks dashboard filter state.
 *
 * Returns a complete `DashboardFilters` with neutral defaults (context view,
 * completed tasks shown, no active filters). Tests pass `overrides` for the
 * dimensions they exercise. Consolidating the builder here means a new required
 * `DashboardFilters` field is added in one place instead of per test file.
 */
import type { DashboardFilters } from "@/types";
import {
  VIEW_MODE,
  INBOX_STATUS_FILTER,
  MEETING_DATE_FILTER,
  DEFAULT_DUE_DATE_FILTER,
  DEFAULT_START_DATE_FILTER,
  DEFAULT_SCHEDULED_DATE_FILTER,
  GROUP_BY_DATE_FIELD,
} from "@/constants";

export function makeFilters(overrides: Partial<DashboardFilters> = {}): DashboardFilters {
  return {
    viewMode: VIEW_MODE.CONTEXT,
    sortBy: [],
    groupByDateField: GROUP_BY_DATE_FIELD.DUE,
    showCompleted: true,
    contextFilter: [],
    dueDateFilter: DEFAULT_DUE_DATE_FILTER,
    startDateFilter: DEFAULT_START_DATE_FILTER,
    scheduledDateFilter: DEFAULT_SCHEDULED_DATE_FILTER,
    priorityFilter: [],
    projectStatusFilter: [],
    inboxStatusFilter: INBOX_STATUS_FILTER.ALL,
    meetingDateFilter: MEETING_DATE_FILTER.ALL,
    clientFilter: [],
    engagementFilter: [],
    includeUnassignedClients: false,
    includeUnassignedEngagements: false,
    tagFilter: [],
    includeUntagged: false,
    searchText: "",
    ...overrides,
  };
}
