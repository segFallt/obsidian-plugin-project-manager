import type { DataviewTask, DashboardFilters } from "../../types";
import { PRIORITY_DISPLAY } from "../../constants";
import { getTaskPriority } from "../../utils/task-utils";
import type { ITaskSortService } from "../../services/interfaces";
import type { TaskListRenderer } from "../task-list-renderer";

/**
 * Renders tasks grouped by priority level (1 = Urgent → 5 = Someday).
 * Groups with no tasks are omitted.
 */
export class PriorityViewRenderer {
  constructor(
    private readonly sortService: ITaskSortService,
    private readonly renderer: TaskListRenderer
  ) {}

  async render(container: HTMLElement, tasks: DataviewTask[], f: DashboardFilters): Promise<void> {
    for (let priority = 1; priority <= 5; priority++) {
      const priTasks = tasks.filter((t) => getTaskPriority(t) === priority);
      if (priTasks.length === 0) continue;
      container.createEl("h2", { text: PRIORITY_DISPLAY[priority] });
      await this.renderer.renderTaskList(container, this.sortService.sortTasks(priTasks, f.sortBy));
    }
  }
}
