import type { TaskProcessorServices } from "../../plugin-context";
import type { DataviewTask, DataviewApi, DashboardFilters } from "../../types";
import { TASK_CONTEXTS, CSS_CLS, CONTEXT } from "../../constants";
import { getTaskContext, getParentProjectPath, getParentRecurringMeetingPath } from "../../utils/task-utils";
import type { ITaskSortService } from "../../services/interfaces";
import type { TaskListRenderer } from "../task-list-renderer";

/**
 * Renders tasks grouped by context (Project, Person, Meeting, Inbox, etc.).
 * Project-note tasks are nested under their parent project heading.
 * Recurring meeting event tasks are nested under their parent recurring meeting heading.
 */
export class ContextViewRenderer {
  constructor(
    private readonly services: TaskProcessorServices,
    private readonly sortService: ITaskSortService,
    private readonly renderer: TaskListRenderer
  ) {}

  async render(
    container: HTMLElement,
    tasks: DataviewTask[],
    f: DashboardFilters,
    dv: DataviewApi
  ): Promise<void> {
    for (const context of TASK_CONTEXTS) {
      const ctxTasks = tasks.filter(
        (t) => getTaskContext(t, this.services.settings.folders) === context
      );
      if (ctxTasks.length === 0) continue;

      container.createEl("h2", { text: context });

      const byFile: Record<string, DataviewTask[]> = {};
      const projectNoteMapping: Record<string, Record<string, DataviewTask[]>> = {};
      const recurringMeetingMapping: Record<string, Record<string, DataviewTask[]>> = {};

      for (const task of ctxTasks) {
        const filePath = task.link.path;

        if (context === CONTEXT.PROJECT) {
          const parentProjectPath = getParentProjectPath(
            filePath,
            dv,
            this.services.settings.folders.projects
          );
          if (parentProjectPath) {
            if (!byFile[parentProjectPath]) byFile[parentProjectPath] = [];
            if (!projectNoteMapping[parentProjectPath]) projectNoteMapping[parentProjectPath] = {};
            if (!projectNoteMapping[parentProjectPath][filePath])
              projectNoteMapping[parentProjectPath][filePath] = [];
            projectNoteMapping[parentProjectPath][filePath].push(task);
            byFile[parentProjectPath].push(task);
            continue;
          }
        }

        if (context === CONTEXT.RECURRING_MEETING) {
          const parentMeetingPath = getParentRecurringMeetingPath(
            filePath,
            dv,
            this.services.settings.folders.meetingsRecurring
          );
          if (parentMeetingPath) {
            if (!byFile[parentMeetingPath]) byFile[parentMeetingPath] = [];
            if (!recurringMeetingMapping[parentMeetingPath]) recurringMeetingMapping[parentMeetingPath] = {};
            if (!recurringMeetingMapping[parentMeetingPath][filePath])
              recurringMeetingMapping[parentMeetingPath][filePath] = [];
            recurringMeetingMapping[parentMeetingPath][filePath].push(task);
            byFile[parentMeetingPath].push(task);
            continue;
          }
        }

        if (!byFile[filePath]) byFile[filePath] = [];
        byFile[filePath].push(task);
      }

      const fileGroups = Object.entries(byFile)
        .map(([fp, ts]) => ({ filePath: fp, tasks: ts }))
        .sort((a, b) => this.sortService.compareGroups(a.tasks, b.tasks, f.sortBy));

      for (const { filePath, tasks: fileTasks } of fileGroups) {
        const page = dv.page(filePath);
        const name = page?.file.name ?? filePath;
        container.createEl("h3").innerHTML =
          `<a class="${CSS_CLS.INTERNAL_LINK}" data-href="${filePath}" href="${filePath}">${name}</a>`;

        if (context === CONTEXT.PROJECT && projectNoteMapping[filePath]) {
          const directTasks = fileTasks.filter((t) => t.link.path === filePath);
          if (directTasks.length > 0) {
            await this.renderer.renderTaskList(
              container,
              this.sortService.sortTasks(directTasks, f.sortBy)
            );
          }
          for (const [notePath, noteTasks] of Object.entries(projectNoteMapping[filePath])) {
            const notePage = dv.page(notePath);
            const noteName = notePage?.file.name ?? notePath;
            container.createEl("h4").innerHTML =
              `<a class="${CSS_CLS.INTERNAL_LINK}" data-href="${notePath}" href="${notePath}">${noteName}</a>`;
            await this.renderer.renderTaskList(
              container,
              this.sortService.sortTasks(noteTasks, f.sortBy)
            );
          }
        } else if (context === CONTEXT.RECURRING_MEETING && recurringMeetingMapping[filePath]) {
          for (const [eventPath, eventTasks] of Object.entries(recurringMeetingMapping[filePath])) {
            const eventPage = dv.page(eventPath);
            const eventName = eventPage?.file.name ?? eventPath;
            container.createEl("h4").innerHTML =
              `<a class="${CSS_CLS.INTERNAL_LINK}" data-href="${eventPath}" href="${eventPath}">${eventName}</a>`;
            await this.renderer.renderTaskList(
              container,
              this.sortService.sortTasks(eventTasks, f.sortBy)
            );
          }
        } else {
          await this.renderer.renderTaskList(
            container,
            this.sortService.sortTasks(fileTasks, f.sortBy)
          );
        }
      }
    }
  }
}
