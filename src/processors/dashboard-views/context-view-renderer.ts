import type { DataviewTask } from "../../types";
import { TASK_CONTEXTS, CONTEXT, HTML_TAG, VIEW_MODE } from "../../constants";
import { createInternalLink } from "../dom-helpers";
import type { IViewRenderer, ViewRenderContext } from "../view-renderer";

/**
 * Renders tasks grouped by context (Project, Person, Meeting, Inbox, etc.).
 * Project-note tasks are nested under their parent project heading.
 * Recurring meeting event tasks are nested under their parent recurring meeting heading.
 */
export class ContextViewRenderer implements IViewRenderer<DataviewTask> {
  readonly mode = VIEW_MODE.CONTEXT;

  async render(ctx: ViewRenderContext<DataviewTask>): Promise<void> {
    const { container, items: tasks, filters: f, helpers } = ctx;
    const { sortService, taskRenderer, contextMap, mtimeMap, parentPathMap, nameMap } = helpers;

    for (const context of TASK_CONTEXTS) {
      const ctxTasks = tasks.filter((t) => contextMap.get(t.path) === context);
      if (ctxTasks.length === 0) continue;

      container.createEl(HTML_TAG.H2, { text: context });

      const byFile: Record<string, DataviewTask[]> = {};
      const projectNoteMapping: Record<string, Record<string, DataviewTask[]>> = {};
      const recurringMeetingMapping: Record<string, Record<string, DataviewTask[]>> = {};

      for (const task of ctxTasks) {
        const filePath = task.link.path;
        const parentPath = parentPathMap.get(filePath) ?? null;

        if (context === CONTEXT.PROJECT && parentPath) {
          if (!byFile[parentPath]) byFile[parentPath] = [];
          if (!projectNoteMapping[parentPath]) projectNoteMapping[parentPath] = {};
          if (!projectNoteMapping[parentPath][filePath])
            projectNoteMapping[parentPath][filePath] = [];
          projectNoteMapping[parentPath][filePath].push(task);
          byFile[parentPath].push(task);
          continue;
        }

        if (context === CONTEXT.RECURRING_MEETING && parentPath) {
          if (!byFile[parentPath]) byFile[parentPath] = [];
          if (!recurringMeetingMapping[parentPath]) recurringMeetingMapping[parentPath] = {};
          if (!recurringMeetingMapping[parentPath][filePath])
            recurringMeetingMapping[parentPath][filePath] = [];
          recurringMeetingMapping[parentPath][filePath].push(task);
          byFile[parentPath].push(task);
          continue;
        }

        if (!byFile[filePath]) byFile[filePath] = [];
        byFile[filePath].push(task);
      }

      const fileGroups = Object.entries(byFile)
        .map(([fp, ts]) => ({ filePath: fp, tasks: ts }))
        .sort((a, b) => sortService.compareGroups(a.tasks, b.tasks, f.sortBy, contextMap, mtimeMap));

      for (const { filePath, tasks: fileTasks } of fileGroups) {
        const name = nameMap.get(filePath) ?? filePath;
        createInternalLink(container.createEl(HTML_TAG.H3), filePath, name);

        if (context === CONTEXT.PROJECT && projectNoteMapping[filePath]) {
          const directTasks = fileTasks.filter((t) => t.link.path === filePath);
          if (directTasks.length > 0) {
            await taskRenderer.renderTaskList(
              container,
              sortService.sortTasks(directTasks, f.sortBy, contextMap, mtimeMap)
            );
          }
          for (const [notePath, noteTasks] of Object.entries(projectNoteMapping[filePath])) {
            const noteName = nameMap.get(notePath) ?? notePath;
            createInternalLink(container.createEl(HTML_TAG.H4), notePath, noteName);
            await taskRenderer.renderTaskList(
              container,
              sortService.sortTasks(noteTasks, f.sortBy, contextMap, mtimeMap)
            );
          }
        } else if (context === CONTEXT.RECURRING_MEETING && recurringMeetingMapping[filePath]) {
          for (const [eventPath, eventTasks] of Object.entries(recurringMeetingMapping[filePath])) {
            const eventName = nameMap.get(eventPath) ?? eventPath;
            createInternalLink(container.createEl(HTML_TAG.H4), eventPath, eventName);
            await taskRenderer.renderTaskList(
              container,
              sortService.sortTasks(eventTasks, f.sortBy, contextMap, mtimeMap)
            );
          }
        } else {
          await taskRenderer.renderTaskList(
            container,
            sortService.sortTasks(fileTasks, f.sortBy, contextMap, mtimeMap)
          );
        }
      }
    }
  }
}
