import type { DataviewTask, DashboardFilters } from "../../types";
import { ISO_DATE_LENGTH, WEEK_DAYS } from "../../constants";
import { addDays } from "../../utils/task-utils";
import { todayISO } from "../../utils/date-utils";
import type { ITaskSortService } from "../../services/interfaces";
import type { TaskListRenderer } from "../task-list-renderer";

/**
 * Renders tasks grouped by due-date bucket:
 * Overdue → Today → Tomorrow → This Week → Upcoming → No Due Date.
 */
export class DateViewRenderer {
  constructor(
    private readonly sortService: ITaskSortService,
    private readonly renderer: TaskListRenderer
  ) {}

  async render(container: HTMLElement, tasks: DataviewTask[], f: DashboardFilters): Promise<void> {
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

    if (overdue.length > 0) {
      container.createEl("h2", { text: "⚠️ Overdue" });
      await this.renderer.renderTaskList(
        container,
        this.sortService.sortTasks(overdue, f.sortBy || "dueDate-asc")
      );
    }
    if (todayTasks.length > 0) {
      container.createEl("h2", { text: "📅 Today" });
      await this.renderer.renderTaskList(
        container,
        this.sortService.sortTasks(todayTasks, f.sortBy || "priority-asc")
      );
    }
    if (tomorrowTasks.length > 0) {
      container.createEl("h2", { text: "📆 Tomorrow" });
      await this.renderer.renderTaskList(
        container,
        this.sortService.sortTasks(tomorrowTasks, f.sortBy || "priority-asc")
      );
    }
    if (thisWeek.length > 0) {
      container.createEl("h2", { text: "📋 This Week" });
      await this.renderer.renderTaskList(
        container,
        this.sortService.sortTasks(thisWeek, f.sortBy || "dueDate-asc")
      );
    }
    if (upcoming.length > 0) {
      container.createEl("h2", { text: "🔮 Upcoming" });
      await this.renderer.renderTaskList(
        container,
        this.sortService.sortTasks(upcoming, f.sortBy || "dueDate-asc")
      );
    }
    if (noDue.length > 0) {
      container.createEl("h2", { text: "📝 No Due Date" });
      await this.renderer.renderTaskList(
        container,
        this.sortService.sortTasks(noDue, f.sortBy || "priority-asc")
      );
    }
  }
}
