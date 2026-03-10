import type { DataviewTask, DashboardFilters } from "../../types";
import type { ITaskSortService } from "../../services/interfaces";
import type { TaskListRenderer } from "../task-list-renderer";

/**
 * Renders tasks grouped by tag. Tags are sorted alphabetically.
 * Untagged tasks appear last under "📌 Untagged".
 */
export class TagViewRenderer {
  constructor(
    private readonly sortService: ITaskSortService,
    private readonly renderer: TaskListRenderer
  ) {}

  render(container: HTMLElement, tasks: DataviewTask[], f: DashboardFilters): void {
    const tagMap: Record<string, DataviewTask[]> = {};
    const untagged: DataviewTask[] = [];

    for (const task of tasks) {
      const tags = task.tags ?? [];
      if (tags.length === 0) {
        untagged.push(task);
      } else {
        for (const tag of tags) {
          if (!tagMap[tag]) tagMap[tag] = [];
          tagMap[tag].push(task);
        }
      }
    }

    for (const tag of Object.keys(tagMap).sort()) {
      container.createEl("h2", { text: tag });
      this.renderer.renderTaskList(container, this.sortService.sortTasks(tagMap[tag], f.sortBy));
    }

    if (untagged.length > 0) {
      container.createEl("h2", { text: "📌 Untagged" });
      this.renderer.renderTaskList(container, this.sortService.sortTasks(untagged, f.sortBy));
    }
  }
}
