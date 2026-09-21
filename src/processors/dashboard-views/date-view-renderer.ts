import type { DataviewTask, DateBucketLabels, GroupByDateField, SortKey } from "../../types";
import {
  ISO_DATE_LENGTH,
  WEEK_DAYS,
  HTML_TAG,
  DATE_BUCKET_LABEL,
  START_BUCKET_LABEL,
  SCHEDULED_BUCKET_LABEL,
  GROUP_BY_DATE_FIELD,
  VIEW_MODE,
  SORT_FIELD,
  SORT_DIRECTION,
} from "../../constants";
import { addDays } from "../../utils/task-utils";
import { todayISO } from "../../utils/date-utils";
import type { IViewRenderer, ViewRenderContext } from "../view-renderer";

/** Reads the grouped-on date value off a task for the active group-by field. */
type DateAccessor = (task: DataviewTask) => unknown;

/** One rendered date bucket: its heading, its tasks, and its default in-bucket sort. */
interface DateBucket {
  label: string;
  tasks: DataviewTask[];
  /** When no explicit sort is set, undated/near buckets fall back to priority; the rest to due date. */
  sortByPriority: boolean;
}

/** Maps each group-by field to the task property it buckets on. */
const DATE_ACCESSORS: Record<GroupByDateField, DateAccessor> = {
  [GROUP_BY_DATE_FIELD.DUE]: (t) => t.due,
  [GROUP_BY_DATE_FIELD.START]: (t) => t.start,
  [GROUP_BY_DATE_FIELD.SCHEDULED]: (t) => t.scheduled,
};

/** Maps each group-by field to its per-boundary label set. */
const DATE_LABEL_SETS: Record<GroupByDateField, DateBucketLabels> = {
  [GROUP_BY_DATE_FIELD.DUE]: DATE_BUCKET_LABEL,
  [GROUP_BY_DATE_FIELD.START]: START_BUCKET_LABEL,
  [GROUP_BY_DATE_FIELD.SCHEDULED]: SCHEDULED_BUCKET_LABEL,
};

/**
 * Buckets tasks into the six Date-view boundaries — Overdue / Today / Tomorrow /
 * This Week / Upcoming / No-date — parameterised by the date `accessor` and the
 * `labelSet`. The boundaries are identical for every field; only the labels
 * differ. Returned in render order; empty buckets are included (the renderer
 * skips them) so all three fields share one code path.
 */
export function bucketTasksByDate(
  tasks: DataviewTask[],
  accessor: DateAccessor,
  labelSet: DateBucketLabels
): DateBucket[] {
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const weekEnd = addDays(today, WEEK_DAYS);

  const isoOf = (t: DataviewTask): string | null => {
    const value = accessor(t);
    return value ? String(value).substring(0, ISO_DATE_LENGTH) : null;
  };

  const overdue: DataviewTask[] = [];
  const todayTasks: DataviewTask[] = [];
  const tomorrowTasks: DataviewTask[] = [];
  const thisWeek: DataviewTask[] = [];
  const upcoming: DataviewTask[] = [];
  const noDate: DataviewTask[] = [];

  for (const t of tasks) {
    const d = isoOf(t);
    if (d === null) noDate.push(t);
    else if (d < today) overdue.push(t);
    else if (d === today) todayTasks.push(t);
    else if (d === tomorrow) tomorrowTasks.push(t);
    else if (d <= weekEnd) thisWeek.push(t);
    else upcoming.push(t);
  }

  return [
    { label: labelSet.OVERDUE, tasks: overdue, sortByPriority: false },
    { label: labelSet.TODAY, tasks: todayTasks, sortByPriority: true },
    { label: labelSet.TOMORROW, tasks: tomorrowTasks, sortByPriority: true },
    { label: labelSet.THIS_WEEK, tasks: thisWeek, sortByPriority: false },
    { label: labelSet.UPCOMING, tasks: upcoming, sortByPriority: false },
    { label: labelSet.NO_DUE_DATE, tasks: noDate, sortByPriority: true },
  ];
}

/**
 * Renders tasks grouped by a chosen date field (Due / Start / Scheduled), using
 * the same six boundaries for every field:
 * Overdue → Today → Tomorrow → This Week → Upcoming → No-date.
 */
export class DateViewRenderer implements IViewRenderer<DataviewTask> {
  readonly mode = VIEW_MODE.DATE;

  async render(ctx: ViewRenderContext<DataviewTask>): Promise<void> {
    const { container, items: tasks, filters: f, helpers } = ctx;
    const { sortService, taskRenderer, contextMap, mtimeMap } = helpers;

    const field = f.groupByDateField;
    const buckets = bucketTasksByDate(tasks, DATE_ACCESSORS[field], DATE_LABEL_SETS[field]);

    const dueDateAsc: SortKey[] = [{ field: SORT_FIELD.DUE_DATE, direction: SORT_DIRECTION.ASC }];
    const priorityAsc: SortKey[] = [{ field: SORT_FIELD.PRIORITY, direction: SORT_DIRECTION.ASC }];

    for (const bucket of buckets) {
      if (bucket.tasks.length === 0) continue;
      container.createEl(HTML_TAG.H2, { text: bucket.label });
      const sortKeys = f.sortBy.length > 0 ? f.sortBy : bucket.sortByPriority ? priorityAsc : dueDateAsc;
      await taskRenderer.renderTaskList(
        container,
        sortService.sortTasks(bucket.tasks, sortKeys, contextMap, mtimeMap)
      );
    }
  }
}
