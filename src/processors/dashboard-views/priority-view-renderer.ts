import type { DataviewTask } from "../../types";
import { PRIORITY_DISPLAY, HTML_TAG, VIEW_MODE } from "../../constants";
import { getTaskPriority } from "../../utils/task-utils";
import type { IViewRenderer, ViewRenderContext } from "../view-renderer";

/**
 * Renders tasks grouped by priority level (1 = Urgent → 4 = Low).
 * Groups with no tasks are omitted.
 */
export class PriorityViewRenderer implements IViewRenderer<DataviewTask> {
  readonly mode = VIEW_MODE.PRIORITY;

  async render(ctx: ViewRenderContext<DataviewTask>): Promise<void> {
    const { container, items: tasks, filters: f, helpers } = ctx;
    const { sortService, taskRenderer, contextMap, mtimeMap } = helpers;

    for (let priority = 1; priority <= 4; priority++) {
      const priTasks = tasks.filter((t) => getTaskPriority(t) === priority);
      if (priTasks.length === 0) continue;
      container.createEl(HTML_TAG.H2, { text: PRIORITY_DISPLAY[priority] });
      await taskRenderer.renderTaskList(container, sortService.sortTasks(priTasks, f.sortBy, contextMap, mtimeMap));
    }
  }
}
