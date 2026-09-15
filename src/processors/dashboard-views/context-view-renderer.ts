import type { TaskProcessorServices } from "../../plugin-context";
import type { DataviewTask, DataviewApi, DashboardFilters } from "../../types";
import { TASK_CONTEXTS, CONTEXT, HTML_TAG } from "../../constants";
import { createInternalLink } from "../dom-helpers";
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
    dv: DataviewApi,
    contextMap?: Map<string, string>,
    mtimeMap?: Map<string, number>
  ): Promise<void> {
    for (const context of TASK_CONTEXTS) {
      const ctxTasks = tasks.filter(
        (t) => getTaskContext(t, this.services.settings.folders) === context
      );
      if (ctxTasks.length === 0) continue;

      container.createEl(HTML_TAG.H2, { text: context });

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
        .sort((a, b) => this.sortService.compareGroups(a.tasks, b.tasks, f.sortBy, contextMap, mtimeMap));

      for (const { filePath, tasks: fileTasks } of fileGroups) {
        const page = dv.page(filePath);
        const name = page?.file.name ?? filePath;
        createInternalLink(container.createEl(HTML_TAG.H3), filePath, name);

        if (context === CONTEXT.PROJECT && projectNoteMapping[filePath]) {
          const directTasks = fileTasks.filter((t) => t.link.path === filePath);
          if (directTasks.length > 0) {
            await this.renderer.renderTaskList(
              container,
              this.sortService.sortTasks(directTasks, f.sortBy, contextMap, mtimeMap)
            );
          }
          for (const [notePath, noteTasks] of Object.entries(projectNoteMapping[filePath])) {
            const notePage = dv.page(notePath);
            const noteName = notePage?.file.name ?? notePath;
            createInternalLink(container.createEl(HTML_TAG.H4), notePath, noteName);
            await this.renderer.renderTaskList(
              container,
              this.sortService.sortTasks(noteTasks, f.sortBy, contextMap, mtimeMap)
            );
          }
        } else if (context === CONTEXT.RECURRING_MEETING && recurringMeetingMapping[filePath]) {
          for (const [eventPath, eventTasks] of Object.entries(recurringMeetingMapping[filePath])) {
            const eventPage = dv.page(eventPath);
            const eventName = eventPage?.file.name ?? eventPath;
            createInternalLink(container.createEl(HTML_TAG.H4), eventPath, eventName);
            await this.renderer.renderTaskList(
              container,
              this.sortService.sortTasks(eventTasks, f.sortBy, contextMap, mtimeMap)
            );
          }
        } else {
          await this.renderer.renderTaskList(
            container,
            this.sortService.sortTasks(fileTasks, f.sortBy, contextMap, mtimeMap)
          );
        }
      }
    }
  }
}
