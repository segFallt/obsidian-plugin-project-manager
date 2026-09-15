import type { DataviewTask, SortField, SortDirection } from "../../types";
import { ISO_DATE_LENGTH, WEEK_DAYS, HTML_TAG, DATE_BUCKET_LABEL, VIEW_MODE } from "../../constants";
import { addDays } from "../../utils/task-utils";
import { todayISO } from "../../utils/date-utils";
import type { IViewRenderer, ViewRenderContext } from "../view-renderer";

/**
 * Renders tasks grouped by due-date bucket:
 * Overdue → Today → Tomorrow → This Week → Upcoming → No Due Date.
 */
export class DateViewRenderer implements IViewRenderer<DataviewTask> {
  readonly mode = VIEW_MODE.DATE;

  async render(ctx: ViewRenderContext<DataviewTask>): Promise<void> {
    const { container, items: tasks, filters: f, helpers } = ctx;
    const { sortService, taskRenderer, contextMap, mtimeMap } = helpers;

    const today = todayISO();
    const tomorrow = addDays(today, 1);
    const weekEnd = addDays(today, WEEK_DAYS);

    const overdue = tasks.filter(
      (t) => t.due && String(t.due).substring(0, ISO_DATE_LENGTH) < today
    );
    const todayTasks = tasks.filter(
      (t) => t.due && String(t.due).substring(0, ISO_DATE_LENGTH) === today
    );
    const tomorrowTasks = tasks.filter(
      (t) => t.due && String(t.due).substring(0, ISO_DATE_LENGTH) === tomorrow
    );
    const thisWeek = tasks.filter((t) => {
      if (!t.due) return false;
      const d = String(t.due).substring(0, ISO_DATE_LENGTH);
      return d > tomorrow && d <= weekEnd;
    });
    const upcoming = tasks.filter(
      (t) => t.due && String(t.due).substring(0, ISO_DATE_LENGTH) > weekEnd
    );
    const noDue = tasks.filter((t) => !t.due);

    const dueDateAsc = f.sortBy.length > 0 ? f.sortBy : [{ field: "dueDate" as SortField, direction: "asc" as SortDirection }];
    const priorityAsc = f.sortBy.length > 0 ? f.sortBy : [{ field: "priority" as SortField, direction: "asc" as SortDirection }];

    if (overdue.length > 0) {
      container.createEl(HTML_TAG.H2, { text: DATE_BUCKET_LABEL.OVERDUE });
      await taskRenderer.renderTaskList(
        container,
        sortService.sortTasks(overdue, dueDateAsc, contextMap, mtimeMap)
      );
    }
    if (todayTasks.length > 0) {
      container.createEl(HTML_TAG.H2, { text: DATE_BUCKET_LABEL.TODAY });
      await taskRenderer.renderTaskList(
        container,
        sortService.sortTasks(todayTasks, priorityAsc, contextMap, mtimeMap)
      );
    }
    if (tomorrowTasks.length > 0) {
      container.createEl(HTML_TAG.H2, { text: DATE_BUCKET_LABEL.TOMORROW });
      await taskRenderer.renderTaskList(
        container,
        sortService.sortTasks(tomorrowTasks, priorityAsc, contextMap, mtimeMap)
      );
    }
    if (thisWeek.length > 0) {
      container.createEl(HTML_TAG.H2, { text: DATE_BUCKET_LABEL.THIS_WEEK });
      await taskRenderer.renderTaskList(
        container,
        sortService.sortTasks(thisWeek, dueDateAsc, contextMap, mtimeMap)
      );
    }
    if (upcoming.length > 0) {
      container.createEl(HTML_TAG.H2, { text: DATE_BUCKET_LABEL.UPCOMING });
      await taskRenderer.renderTaskList(
        container,
        sortService.sortTasks(upcoming, dueDateAsc, contextMap, mtimeMap)
      );
    }
    if (noDue.length > 0) {
      container.createEl(HTML_TAG.H2, { text: DATE_BUCKET_LABEL.NO_DUE_DATE });
      await taskRenderer.renderTaskList(
        container,
        sortService.sortTasks(noDue, priorityAsc, contextMap, mtimeMap)
      );
    }
  }
}
